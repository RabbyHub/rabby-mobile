# frozen_string_literal: true

# Run with: ruby apps/mobile/scripts/validate-hash/verify_podfile_lock.test.rb

require 'digest'
require 'fileutils'
require 'json'
require 'minitest/autorun'
require 'tmpdir'
require 'yaml'

require_relative 'verify_podfile_lock'

class VerifyPodfileLockTest < Minitest::Test
  NAME = 'AppAuth'
  VERSION = '1.7.6'

  ORIGINAL_SPEC = <<~JSON
    {
      "name": "AppAuth",
      "version": "1.7.6",
      "source": {
        "git": "https://github.com/openid/AppAuth-iOS.git",
        "tag": "1.7.6"
      },
      "subspecs": [
        {
          "name": "Core"
        }
      ]
    }
  JSON

  def setup
    @specs_dir = Dir.mktmpdir('specs')
  end

  def teardown
    FileUtils.rm_rf(@specs_dir)
  end

  def sha1(text)
    Digest::SHA1.hexdigest(text)
  end

  # Mirrors what trunk does when a version is deprecated: one top-level line is
  # inserted between two existing keys (here, after the "source" object).
  def deprecate(text, line)
    text.sub(/^  \},\n/) { "  },\n  #{line},\n" }
  end

  def deprecate_last(text, line)
    text.sub(/\n\}\n\z/, ",\n  #{line}\n}\n")
  end

  def cache_spec(text, name: NAME, version: VERSION)
    path = PodfileLockVerifier.podspec_path(@specs_dir, name, version)
    FileUtils.mkdir_p(File.dirname(path))
    File.binwrite(path, text)
  end

  def lockfile(checksum, overrides = {})
    {
      'PODS' => [{ "#{NAME} (#{VERSION})" => ["#{NAME}/Core (= #{VERSION})"] }, "#{NAME}/Core (#{VERSION})"],
      'DEPENDENCIES' => [NAME],
      'SPEC REPOS' => { 'trunk' => [NAME] },
      # Real lockfiles use symbol keys here; the CLI test round-trips them.
      'EXTERNAL SOURCES' => { 'Local' => { path: '../node_modules/local' } },
      'SPEC CHECKSUMS' => { NAME => checksum },
      'PODFILE CHECKSUM' => 'abc',
      'COCOAPODS' => '1.14.3'
    }.merge(overrides)
  end

  def verify(committed, installed)
    PodfileLockVerifier.verify(committed, installed, @specs_dir)
  end

  def test_identical_lockfiles_pass
    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile(sha1(ORIGINAL_SPEC)))
    assert_empty result.errors
    assert_empty result.warnings
  end

  def test_accepts_deprecation_inserted_between_keys
    deprecated = deprecate(ORIGINAL_SPEC, '"deprecated": true')
    refute_equal ORIGINAL_SPEC, deprecated
    cache_spec(deprecated)

    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile(sha1(deprecated)))
    assert_empty result.errors
    assert_equal 1, result.warnings.size
    assert_match(/AppAuth 1\.7\.6 was deprecated upstream/, result.warnings.first)
  end

  def test_accepts_deprecation_as_last_key
    deprecated = deprecate_last(ORIGINAL_SPEC, '"deprecated": true')
    cache_spec(deprecated)

    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile(sha1(deprecated)))
    assert_empty result.errors
  end

  def test_accepts_deprecated_in_favor_of
    deprecated = deprecate_last(
      deprecate(ORIGINAL_SPEC, '"deprecated": true'),
      '"deprecated_in_favor_of": "AppAuthCore"'
    )
    cache_spec(deprecated)

    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile(sha1(deprecated)))
    assert_empty result.errors
  end

  def test_rejects_other_changes_alongside_deprecation
    changed = deprecate(ORIGINAL_SPEC.sub('"tag": "1.7.6"', '"tag": "1.7.6-evil"'), '"deprecated": true')
    cache_spec(changed)

    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile(sha1(changed)))
    assert_equal 1, result.errors.size
    assert_match(/changed beyond the deprecation marker/, result.errors.first)
  end

  def test_rejects_changes_without_deprecation
    changed = ORIGINAL_SPEC.sub('"tag": "1.7.6"', '"tag": "1.7.6-evil"')
    cache_spec(changed)

    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile(sha1(changed)))
    assert_match(/without a deprecation/, result.errors.first)
  end

  def test_strip_ignores_nested_deprecation_key
    nested = ORIGINAL_SPEC.sub('"name": "Core"', "\"name\": \"Core\",\n      \"deprecated\": true")
    assert_equal nested, PodfileLockVerifier.strip_deprecation(nested)
  end

  def test_rejects_when_cached_podspec_does_not_match_installed_checksum
    deprecated = deprecate(ORIGINAL_SPEC, '"deprecated": true')
    cache_spec(deprecated)

    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile('0' * 40))
    assert_match(/does not match the installed checksum/, result.errors.first)
  end

  def test_rejects_missing_cached_podspec
    result = verify(lockfile(sha1(ORIGINAL_SPEC)), lockfile('0' * 40))
    assert_match(/cached podspec is missing/, result.errors.first)
  end

  def test_rejects_checksum_change_for_non_trunk_pod
    deprecated = deprecate(ORIGINAL_SPEC, '"deprecated": true')
    cache_spec(deprecated)
    committed = lockfile(sha1(ORIGINAL_SPEC), 'SPEC REPOS' => {}, 'EXTERNAL SOURCES' => { NAME => { path: '../x' } })
    installed = lockfile(sha1(deprecated), 'SPEC REPOS' => {}, 'EXTERNAL SOURCES' => { NAME => { path: '../x' } })

    result = verify(committed, installed)
    assert_match(/not from trunk/, result.errors.first)
  end

  def test_rejects_any_other_section_change
    sum = sha1(ORIGINAL_SPEC)
    {
      'PODS' => ["#{NAME} (1.7.7)"],
      'DEPENDENCIES' => ["#{NAME} (= 1.7.7)"],
      'PODFILE CHECKSUM' => 'def',
      'COCOAPODS' => '1.16.2',
      'CHECKOUT OPTIONS' => { NAME => { git: 'x' } }
    }.each do |key, value|
      result = verify(lockfile(sum), lockfile(sum, key => value))
      assert_equal ["#{key} differs from the committed Podfile.lock"], result.errors, key
    end
  end

  def test_rejects_added_or_removed_checksums
    sum = sha1(ORIGINAL_SPEC)
    added = lockfile(sum, 'SPEC CHECKSUMS' => { NAME => sum, 'Extra' => sum })

    assert_equal ['Extra: checksum added'], verify(lockfile(sum), added).errors
    assert_equal ['Extra: checksum removed'], verify(added, lockfile(sum)).errors
  end

  def test_cli_exit_status
    Dir.mktmpdir('locks') do |dir|
      committed = File.join(dir, 'committed.lock')
      installed = File.join(dir, 'installed.lock')
      deprecated = deprecate(ORIGINAL_SPEC, '"deprecated": true')
      cache_spec(deprecated)
      File.write(committed, lockfile(sha1(ORIGINAL_SPEC)).to_yaml)

      File.write(installed, lockfile(sha1(deprecated)).to_yaml)
      out, = capture_io do
        assert_equal 0, PodfileLockVerifier.run([committed, installed, '--specs-dir', @specs_dir])
      end
      assert_match(/^\[warn\] AppAuth 1\.7\.6 was deprecated upstream/, out)

      File.write(installed, lockfile(sha1(ORIGINAL_SPEC), 'COCOAPODS' => '1.16.2').to_yaml)
      out, = capture_io do
        assert_equal 1, PodfileLockVerifier.run([committed, installed, '--specs-dir', @specs_dir])
      end
      assert_match(/^\[error\] COCOAPODS differs/, out)
    end
  end
end
