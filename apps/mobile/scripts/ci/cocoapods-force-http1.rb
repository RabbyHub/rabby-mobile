# frozen_string_literal: true

# CocoaPods' CDN client explicitly requests HTTP/2 through Typhoeus. Some
# build-network paths consistently fail those requests with CURLE_HTTP2 while
# the same CDN is reachable over HTTP/1.1. This hook is loaded only for the
# bounded fallback attempt after a normal `pod install` has failed.
require 'typhoeus'

module RabbyCocoaPodsForceHttp1
  def initialize(base_url, options = {})
    if options[:http_version] == :httpv2_0
      options = options.merge(:http_version => :httpv1_1)
    end

    super(base_url, options)
  end
end

Typhoeus::Request.prepend(RabbyCocoaPodsForceHttp1)
