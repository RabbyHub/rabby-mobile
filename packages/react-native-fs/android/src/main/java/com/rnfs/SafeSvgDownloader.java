package com.rnfs;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

final class SafeSvgDownloader {
  interface Completion {
    void complete(int code, int httpStatus, long bytesWritten);
  }

  static final int OK = 0;
  static final int INVALID_URL = 1;
  static final int HTTP_STATUS = 2;
  static final int TOO_LARGE = 3;
  static final int TIMEOUT = 4;
  static final int IO = 5;
  static final int NETWORK = 6;

  private static final int MAX_REDIRECTS = 5;
  private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(3);

  private SafeSvgDownloader() {}

  static void download(
      String source,
      String destination,
      long maxBytes,
      int timeoutMs,
      Completion completion) {
    EXECUTOR.execute(() -> {
      Result result = run(source, destination, maxBytes, timeoutMs);
      completion.complete(result.code, result.httpStatus, result.bytesWritten);
    });
  }

  private static Result run(
      String source, String destination, long maxBytes, int timeoutMs) {
    File target = new File(destination);
    Result result = runInternal(source, target, maxBytes, timeoutMs);
    if (result.code != OK) {
      target.delete();
    }
    return result;
  }

  private static Result runInternal(
      String source, File target, long maxBytes, int timeoutMs) {
    int status = 0;
    long bytes = 0;
    long deadlineNanos =
        System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(Math.max(timeoutMs, 1));
    HttpURLConnection connection = null;

    try {
      URL current = validateUrl(source);
      for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        int remainingMs = remainingMs(deadlineNanos);
        if (remainingMs <= 0) {
          return new Result(TIMEOUT, status, bytes);
        }

        connection = (HttpURLConnection) current.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setUseCaches(false);
        connection.setConnectTimeout(remainingMs);
        connection.setReadTimeout(remainingMs);
        connection.setRequestProperty("Accept", "image/svg+xml,application/xml,text/xml;q=0.9,*/*;q=0.1");
        connection.setRequestProperty("User-Agent", "RabbyMobile-SafeMedia/1");
        connection.connect();
        status = connection.getResponseCode();

        if (isRedirect(status)) {
          if (redirect == MAX_REDIRECTS) {
            return new Result(NETWORK, status, bytes);
          }
          String location = connection.getHeaderField("Location");
          connection.disconnect();
          connection = null;
          if (location == null || location.isEmpty()) {
            return new Result(NETWORK, status, bytes);
          }
          current = validateUrl(new URL(current, location).toString());
          continue;
        }

        if (status < 200 || status >= 300) {
          return new Result(HTTP_STATUS, status, bytes);
        }
        long contentLength = connection.getContentLengthLong();
        if (contentLength > maxBytes) {
          return new Result(TOO_LARGE, status, bytes);
        }

        File parent = target.getParentFile();
        if (parent == null || !parent.isDirectory()) {
          return new Result(IO, status, bytes);
        }

        try (InputStream input =
                 new BufferedInputStream(connection.getInputStream(), 16 * 1024);
             FileOutputStream output = new FileOutputStream(target, false)) {
          byte[] buffer = new byte[16 * 1024];
          int count;
          while ((count = input.read(buffer)) != -1) {
            if (remainingMs(deadlineNanos) <= 0) {
              return new Result(TIMEOUT, status, bytes);
            }
            if (bytes > maxBytes - count) {
              return new Result(TOO_LARGE, status, bytes);
            }
            output.write(buffer, 0, count);
            bytes += count;
          }
          output.getFD().sync();
        }
        return bytes > 0
            ? new Result(OK, status, bytes)
            : new Result(NETWORK, status, bytes);
      }
      return new Result(NETWORK, status, bytes);
    } catch (InvalidSafeMediaUrl ignored) {
      return new Result(INVALID_URL, status, bytes);
    } catch (java.net.SocketTimeoutException ignored) {
      return new Result(TIMEOUT, status, bytes);
    } catch (java.io.FileNotFoundException ignored) {
      return new Result(status >= 400 ? HTTP_STATUS : IO, status, bytes);
    } catch (java.io.IOException ignored) {
      return new Result(NETWORK, status, bytes);
    } catch (Exception ignored) {
      return new Result(NETWORK, status, bytes);
    } finally {
      if (connection != null) {
        connection.disconnect();
      }
    }
  }

  private static int remainingMs(long deadlineNanos) {
    long remaining = deadlineNanos - System.nanoTime();
    if (remaining <= 0) {
      return 0;
    }
    return (int) Math.min(
        Integer.MAX_VALUE,
        Math.max(1, TimeUnit.NANOSECONDS.toMillis(remaining)));
  }

  private static boolean isRedirect(int statusCode) {
    return statusCode == 301 || statusCode == 302 || statusCode == 303 ||
        statusCode == 307 || statusCode == 308;
  }

  private static URL validateUrl(String value) throws Exception {
    URI uri = new URI(value);
    if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null ||
        uri.getHost().isEmpty() || uri.getUserInfo() != null ||
        (uri.getPort() != -1 && uri.getPort() != 443)) {
      throw new InvalidSafeMediaUrl();
    }
    String host = uri.getHost().toLowerCase(Locale.ROOT);
    if (host.equals("localhost") || host.endsWith(".localhost") ||
        host.endsWith(".local") || isIpLiteral(host)) {
      throw new InvalidSafeMediaUrl();
    }
    return uri.toURL();
  }

  private static boolean isIpLiteral(String host) {
    if (host.indexOf(':') >= 0) {
      return true;
    }
    for (int index = 0; index < host.length(); index += 1) {
      char value = host.charAt(index);
      if ((value < '0' || value > '9') && value != '.') {
        return false;
      }
    }
    return true;
  }

  private static final class InvalidSafeMediaUrl extends Exception {}

  private static final class Result {
    final int code;
    final int httpStatus;
    final long bytesWritten;

    Result(int code, int httpStatus, long bytesWritten) {
      this.code = code;
      this.httpStatus = httpStatus;
      this.bytesWritten = bytesWritten;
    }
  }
}
