#!/usr/bin/env python3
"""Public, fixed-URL dependency evidence for an unsigned GitHub CI build only."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile


ORIGIN = 'https://plugins.gradle.org/m2/'
ARTIFACTS = (
    ('marker', 'org/gradle/toolchains/foojay-resolver-convention/org.gradle.toolchains.foojay-resolver-convention.gradle.plugin/1.0.0/org.gradle.toolchains.foojay-resolver-convention.gradle.plugin-1.0.0.pom'),
    ('plugin-pom', 'org/gradle/toolchains/foojay-resolver/1.0.0/foojay-resolver-1.0.0.pom'),
    ('plugin-jar', 'org/gradle/toolchains/foojay-resolver/1.0.0/foojay-resolver-1.0.0.jar'),
)
HOSTS = frozenset({'plugins.gradle.org', 'plugins-artifacts.gradle.org'})
MAX_BYTES = 5_000_000


def endpoint(url):
    """Never expose userinfo, query strings or fragments, including on errors."""
    parsed = urllib.parse.urlsplit(url)
    return {'host': parsed.hostname, 'path': parsed.path}


def permitted(url):
    parsed = urllib.parse.urlsplit(url)
    return (parsed.scheme == 'https' and parsed.hostname in HOSTS
            and parsed.username is None and parsed.password is None
            and parsed.port in (None, 443))


class PublicRedirects(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        self.chain = []

    def redirect_request(self, request, response, code, message, headers, url):
        if not permitted(url) or len(self.chain) >= 5:
            raise ValueError('Public repository redirect refused')
        self.chain.append({'status': code, 'from': endpoint(request.full_url), 'to': endpoint(url)})
        return super().redirect_request(request, response, code, message, headers, url)


def coordinate(value):
    return value if value and re.fullmatch(r'[A-Za-z0-9_.:+-]{1,200}', value) else None


def inspect_pom(body):
    document = ET.fromstring(body)
    namespace = {'m': 'http://maven.apache.org/POM/4.0.0'}
    def fields(element):
        return {name: coordinate(element.findtext(f'm:{name}', namespaces=namespace))
                for name in ('groupId', 'artifactId', 'version')}
    return {'coordinates': fields(document),
            'dependencies': [fields(item) for item in document.findall('m:dependencies/m:dependency', namespace)]}


def inspect_jar(body):
    descriptor = 'META-INF/gradle-plugins/org.gradle.toolchains.foojay-resolver-convention.properties'
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        info = archive.getinfo(descriptor)
        if info.file_size > 4_096:
            raise ValueError('Unexpected plugin descriptor size')
        for line in archive.read(descriptor).decode('utf8').splitlines():
            if line.startswith('implementation-class='):
                value = line.partition('=')[2].strip()
                if re.fullmatch(r'[A-Za-z0-9_.$]{1,200}', value):
                    return {'descriptor': descriptor, 'implementationClass': value}
    raise ValueError('Expected plugin descriptor missing')


def probe(artifact):
    kind, path = artifact
    redirect = PublicRedirects()
    result = {'artifact': kind, 'source': endpoint(ORIGIN + path), 'redirects': redirect.chain}
    try:
        # No cookies, credentials, arbitrary request headers or environment values
        # are copied into requests or diagnostic output.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), redirect)
        with opener.open(ORIGIN + path, timeout=15) as response:
            result.update({'status': response.status, 'final': endpoint(response.url)})
            if not permitted(response.url):
                raise ValueError('Unexpected repository destination')
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError('Unexpected repository response size')
            result.update({'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()})
            result['content'] = inspect_jar(body) if kind == 'plugin-jar' else inspect_pom(body)
    except urllib.error.HTTPError as error:
        result.update({'status': error.code, 'final': endpoint(error.url), 'error': 'HTTPError'})
    except urllib.error.URLError as error:
        # Exception strings can contain proxy URLs; report only bounded types and
        # numeric cause codes. Gradle's unsigned-only trace supplies Java causes.
        result.update({'error': 'URLError', 'cause': type(error.reason).__name__})
        code = getattr(error.reason, 'errno', None)
        if isinstance(code, int):
            result['errno'] = code
        verify = getattr(error.reason, 'verify_code', None)
        if isinstance(verify, int):
            result['tlsVerifyCode'] = verify
    except Exception as error:
        result['error'] = type(error).__name__
    return result


def main():
    if (os.environ.get('FABELPAD_UNSIGNED_CHECK') != 'true'
            or os.environ.get('CI') != '1'
            or os.environ.get('GITHUB_ACTIONS') != 'true'):
        print('Public Gradle diagnostics require an unsigned GitHub CI build.', file=sys.stderr)
        return 78
    with ThreadPoolExecutor(max_workers=3) as workers:
        for result in workers.map(probe, ARTIFACTS):
            print(json.dumps(result, sort_keys=True), flush=True)
    # These are observations, never a dependency substitute or a retry policy.
    return 0


if __name__ == '__main__':
    sys.exit(main())
