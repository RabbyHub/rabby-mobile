#!/usr/bin/env ruby
# frozen_string_literal: true

# Verifies the Podfile.lock written by `pod install` during hash validation
# against the committed one.
#
# Hash validation used to rely on `pod install --deployment`, which rejects any
# lockfile change. Trunk maintainers can still deprecate a published version,
# which inserts `"deprecated": true` (or `"deprecated_in_favor_of"`) into its
# podspec JSON. CocoaPods records the SHA1 of the podspec file as the spec
# checksum, so that edit changes SPEC CHECKSUMS without changing what gets
# built, and every validation of an older commit would fail.
#
# This check keeps the deployment contract and allows only that one edit:
# - every lockfile section except SPEC CHECKSUMS must be identical;
# - a changed checksum is accepted only for a trunk pod whose cached podspec
#   hashes to the new checksum, declares the deprecation, hashes to the
#   committed checksum once whole lines holding exactly `"deprecated": true`
#   or a plain `"deprecated_in_favor_of"` name are removed, and parses to the
#   same podspec apart from those top-level keys.
# Anything else fails closed.
#
# Usage:
#   ruby verify_podfile_lock.rb COMMITTED_LOCK INSTALLED_LOCK [--specs-dir DIR]
#
# DIR defaults to the CocoaPods trunk cache:
#   ${CP_REPOS_DIR:-${CP_HOME_DIR:-~/.cocoapods}/repos}/trunk/Specs

require 'digest'
require 'json'
require 'optparse'
require 'yaml'

module PodfileLockVerifier
  CHECKSUMS_KEY = 'SPEC CHECKSUMS'
  TRUNK_REPO_KEY = 'trunk'
  DEPRECATION_KEYS = %w[deprecated deprecated_in_favor_of].freeze
  # A removable line holds exactly one deprecation entry with a constrained
  # value and nothing else, so it cannot smuggle other keys (for example a
  # duplicate "source", where the last occurrence wins when parsed).
  DEPRECATION_ENTRY = %r{(?:"deprecated": true|"deprecated_in_favor_of": "[A-Za-z0-9_.+\-/]*")}.freeze
  DEPRECATION_LINE = /^  #{DEPRECATION_ENTRY},\n/.freeze
  TRAILING_DEPRECATION_LINE = /,\n  #{DEPRECATION_ENTRY}\n(\}\n?)\z/.freeze

  Result = Struct.new(:errors, :warnings)

  module_function

  def default_specs_dir
    repos_dir = ENV['CP_REPOS_DIR'] ||
                File.join(ENV['CP_HOME_DIR'] || File.join(Dir.home, '.cocoapods'), 'repos')
    File.join(repos_dir, TRUNK_REPO_KEY, 'Specs')
  end

  # Restores the podspec JSON as it was before trunk marked it deprecated.
  # Only top-level keys (two-space indent in trunk's pretty-printed JSON) are
  # removed, so nested values are never touched.
  def strip_deprecation(text)
    stripped = text.gsub(DEPRECATION_LINE, '')
    loop do
      next_text = stripped.sub(TRAILING_DEPRECATION_LINE) { "\n#{Regexp.last_match(1)}" }
      return stripped if next_text == stripped

      stripped = next_text
    end
  end

  def shard_path(name)
    Digest::MD5.hexdigest(name)[0, 3].chars.join('/')
  end

  def podspec_path(specs_dir, name, version)
    File.join(specs_dir, shard_path(name), name, version, "#{name}.podspec.json")
  end

  # Maps each root pod name to its locked version from the PODS section.
  def root_versions(pods)
    Array(pods).each_with_object({}) do |entry, versions|
      label = entry.is_a?(Hash) ? entry.keys.first : entry
      match = /\A(\S+) \((.+)\)\z/.match(label.to_s)
      next unless match

      versions[match[1].split('/').first] ||= match[2]
    end
  end

  def deprecated?(text)
    spec = JSON.parse(text)
    spec.is_a?(Hash) && (spec['deprecated'] == true || spec.key?('deprecated_in_favor_of'))
  rescue JSON::ParserError
    false
  end

  # The stripped text already hashes to the committed checksum, so the removed
  # lines are the only added bytes. This also requires them to have been
  # top-level keys: a deprecation line placed inside a nested object (such as
  # "source" or a subspec) would leave the parsed podspec otherwise different.
  def deprecation_only_change?(text, stripped)
    current = JSON.parse(text)
    committed = JSON.parse(stripped)
    return false unless current.is_a?(Hash) && committed.is_a?(Hash)

    current.reject { |key, _| DEPRECATION_KEYS.include?(key) } == committed
  rescue JSON::ParserError
    false
  end

  def explain_checksum_change(name, old_sum, new_sum, committed, specs_dir)
    trunk_pods = Array((committed['SPEC REPOS'] || {})[TRUNK_REPO_KEY])
    return "#{name}: checksum changed but the pod is not from trunk" unless trunk_pods.include?(name)

    version = root_versions(committed['PODS'])[name]
    return "#{name}: checksum changed but no locked version was found in PODS" unless version

    path = podspec_path(specs_dir, name, version)
    return "#{name} #{version}: checksum changed but the cached podspec is missing: #{path}" unless File.file?(path)

    text = File.binread(path)
    cached_sum = Digest::SHA1.hexdigest(text)
    unless cached_sum == new_sum
      return "#{name} #{version}: cached podspec #{cached_sum} does not match the installed checksum #{new_sum}"
    end
    return "#{name} #{version}: podspec changed upstream without a deprecation (#{old_sum} -> #{new_sum})" unless deprecated?(text)

    stripped = strip_deprecation(text)
    restored_sum = Digest::SHA1.hexdigest(stripped)
    unless restored_sum == old_sum
      return "#{name} #{version}: podspec changed beyond the deprecation marker " \
             "(#{old_sum} -> #{new_sum}, #{restored_sum} without the marker)"
    end
    unless deprecation_only_change?(text, stripped)
      return "#{name} #{version}: deprecation marker is not limited to top-level deprecation keys " \
             "(#{old_sum} -> #{new_sum})"
    end

    nil
  end

  def verify(committed, installed, specs_dir)
    result = Result.new([], [])

    ((committed.keys | installed.keys) - [CHECKSUMS_KEY]).sort.each do |key|
      result.errors << "#{key} differs from the committed Podfile.lock" unless committed[key] == installed[key]
    end

    old_sums = committed[CHECKSUMS_KEY] || {}
    new_sums = installed[CHECKSUMS_KEY] || {}
    (new_sums.keys - old_sums.keys).sort.each { |name| result.errors << "#{name}: checksum added" }
    (old_sums.keys - new_sums.keys).sort.each { |name| result.errors << "#{name}: checksum removed" }

    (old_sums.keys & new_sums.keys).sort.each do |name|
      old_sum = old_sums[name].to_s
      new_sum = new_sums[name].to_s
      next if old_sum == new_sum

      error = explain_checksum_change(name, old_sum, new_sum, committed, specs_dir)
      if error
        result.errors << error
      else
        version = root_versions(committed['PODS'])[name]
        result.warnings << "#{name} #{version} was deprecated upstream; accepted checksum #{old_sum} -> #{new_sum}"
      end
    end

    result
  end

  # Podfile.lock uses symbol keys such as `:path:` and `:git:` under
  # EXTERNAL SOURCES and CHECKOUT OPTIONS.
  def load_lockfile(path)
    YAML.safe_load(File.read(path), permitted_classes: [Symbol]) || {}
  end

  def run(argv)
    specs_dir = default_specs_dir
    parser = OptionParser.new do |opts|
      opts.banner = 'Usage: verify_podfile_lock.rb COMMITTED_LOCK INSTALLED_LOCK [--specs-dir DIR]'
      opts.on('--specs-dir DIR', 'CocoaPods trunk Specs directory') { |dir| specs_dir = dir }
    end
    committed_path, installed_path = parser.parse(argv)
    unless committed_path && installed_path
      warn parser.banner
      return 2
    end

    result = verify(load_lockfile(committed_path), load_lockfile(installed_path), specs_dir)
    result.warnings.each { |message| puts "[warn] #{message}" }
    result.errors.each { |message| puts "[error] #{message}" }
    if result.errors.empty?
      puts '[ok] Podfile.lock matches the committed lockfile'
      0
    else
      puts '[error] Podfile.lock verification failed'
      1
    end
  end
end

exit(PodfileLockVerifier.run(ARGV)) if $PROGRAM_NAME == __FILE__
