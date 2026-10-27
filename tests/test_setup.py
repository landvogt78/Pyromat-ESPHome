import base64
import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('setup_secrets', ROOT/'tools/setup_secrets.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

class SetupTests(unittest.TestCase):
    def test_creates_valid_distinct_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory)/'secrets.yaml'
            setup.create(output, ROOT/'secrets.example.yaml')
            self.assertTrue(output.exists(), 'setup must create secrets.yaml')
            text=output.read_text(encoding='utf-8')
            pairs=dict(line.split(': ',1) for line in text.splitlines() if line and not line.startswith('#'))
            key=pairs['api_encryption_key'].strip('"')
            self.assertEqual(len(base64.b64decode(key,validate=True)),32)
            self.assertNotIn('GENERATE_ME',text)
            self.assertNotEqual(pairs['fallback_ap_password'],pairs['web_server_password'])

    def test_udp_keys_are_random_separate_and_existing_files_stay_private(self):
        with tempfile.TemporaryDirectory() as directory:
            keys = []
            for number in range(2):
                output = pathlib.Path(directory)/f'secrets-{number}.yaml'
                setup.create(output, ROOT/'secrets.example.yaml')
                pairs = dict(line.split(': ',1) for line in output.read_text().splitlines()
                             if line and not line.startswith('#'))
                self.assertIn('pyromat_a6_udp_key', pairs, 'setup must generate the shared UDP key')
                key = pairs['pyromat_a6_udp_key'].strip('"')
                self.assertEqual(len(bytes.fromhex(key)), 32)
                self.assertNotEqual(key, pairs['api_encryption_key'].strip('"'))
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                keys.append(key)
            self.assertNotEqual(*keys)

    def test_existing_credentials_are_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            output=pathlib.Path(directory)/'secrets.yaml'
            output.write_text('private existing values',encoding='utf-8')
            with self.assertRaises(FileExistsError):
                setup.create(output,ROOT/'secrets.example.yaml')
            self.assertEqual(output.read_text(encoding='utf-8'),'private existing values')

if __name__=='__main__': unittest.main()
