<?php
namespace Ramsoya\Api\Lib;

class HttpClient
{
    public static function get(string $url, array $headers = [], int $timeout = 10, bool $includeResponseHeaders = false): array
    {
        $ch = curl_init($url);
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_HTTPHEADER => $headers,
        ];
        if ($includeResponseHeaders) {
            $options[CURLOPT_HEADER] = true;
        }
        curl_setopt_array($ch, $options);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);

        if ($includeResponseHeaders && $resp !== false) {
            $hdrSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $rawHeaders = substr($resp, 0, $hdrSize);
            $body = substr($resp, $hdrSize);
            $headersArr = preg_split("/\r?\n/", trim($rawHeaders));
        } else {
            $body = $resp === false ? null : $resp;
            $headersArr = [];
        }

        curl_close($ch);

        return [
            'code' => $code,
            'body' => $body,
            'error' => $err ?: null,
            'headers' => $headersArr,
        ];
    }

    public static function post(string $url, string $payload, array $headers = [], int $timeout = 10, bool $includeResponseHeaders = false): array
    {
        $ch = curl_init($url);
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
        ];
        if ($includeResponseHeaders) {
            $options[CURLOPT_HEADER] = true;
        }
        curl_setopt_array($ch, $options);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);

        if ($includeResponseHeaders && $resp !== false) {
            $hdrSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $rawHeaders = substr($resp, 0, $hdrSize);
            $body = substr($resp, $hdrSize);
            $headersArr = preg_split("/\r?\n/", trim($rawHeaders));
        } else {
            $body = $resp === false ? null : $resp;
            $headersArr = [];
        }

        curl_close($ch);

        return [
            'code' => $code,
            'body' => $body,
            'error' => $err ?: null,
            'headers' => $headersArr,
        ];
    }

    public static function head(string $url, array $headers = [], int $timeout = 10): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_NOBODY => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(5, $timeout),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_HEADER => true,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        $hdrSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $rawHeaders = $resp !== false ? substr($resp, 0, $hdrSize) : '';
        $headersArr = $rawHeaders === '' ? [] : preg_split("/\r?\n/", trim($rawHeaders));
        curl_close($ch);

        return [
            'code' => $code,
            'headers' => $headersArr,
            'error' => $err ?: null,
        ];
    }
}
