"""Compiler-free deployment contract for the optional A6 temperature sender."""
from pathlib import Path
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]

class ConfigLoader(yaml.SafeLoader):
    pass

# Only read local YAML; never generate C++ or execute lambdas.
ConfigLoader.add_constructor('!include', lambda loader, node: {'include': loader.construct_scalar(node)})
ConfigLoader.add_constructor('!secret', lambda loader, node: {'secret': loader.construct_scalar(node)})
ConfigLoader.add_constructor('!lambda', lambda loader, node: loader.construct_scalar(node))

def read(path):
    return yaml.load((ROOT / path).read_text(), Loader=ConfigLoader)

class FoxairUdpTests(unittest.TestCase):
    def sender(self):
        self.assertTrue((ROOT/'packages/foxair_udp.yaml').is_file(), 'optional UDP sender is missing')
        return read('packages/foxair_udp.yaml')

    def test_optional_entry_retains_standard_mqtt_and_api_packages(self):
        self.assertTrue((ROOT/'pyromat-foxair.yaml').is_file(), 'FoxAIR entry configuration is missing')
        entry = read('pyromat-foxair.yaml')
        self.assertEqual(set(x['include'] for x in entry['packages'].values()),
                         {'pyromat.yaml', 'packages/foxair_udp.yaml'})
        self.assertEqual(set(x['include'] for x in read('pyromat.yaml')['packages'].values()),
                         {'packages/bridge.yaml', 'packages/mqtt.yaml'})
        self.assertEqual(set(x['include'] for x in read('pyromat-api.yaml')['packages'].values()),
                         {'packages/bridge.yaml'})
        self.assertEqual(read('packages/bridge.yaml')['substitutions']['device_name'], 'pyromat')

    def test_each_live_value_has_its_own_timeout_without_periodic_cache_refresh(self):
        sensors = {s['id']: s for s in self.sender()['sensor']}
        originals = {s['id']: s for s in read('packages/entities.yaml')['sensor']}
        expected = {'foxair_wood_top_live': 'puffer_oben',
                    'foxair_wood_mid_live': 'puffer_mitte',
                    'foxair_wood_bottom_live': 'puffer_unten'}
        self.assertEqual(set(sensors), set(expected))
        for live, source in expected.items():
            with self.subTest(sensor=live):
                s = sensors[live]
                self.assertEqual(s['platform'], 'copy')
                self.assertEqual(s['source_id'], source)
                self.assertTrue(s['internal'])
                self.assertNotIn('update_interval', s)
                self.assertEqual(s['filters'], [{'timeout': '15s'}])
                self.assertEqual(originals[source]['update_interval'], 'never')
                self.assertEqual(originals[source]['filters'], [{'timeout': '60s'}])

    def test_wire_contract_matches_a6_receiver_and_preserves_nan(self):
        config = self.sender()
        udp = config['udp']
        self.assertEqual(udp['port'], 18511)
        transport, = config['packet_transport']
        self.assertEqual(transport['platform'], 'udp')
        self.assertEqual(transport['udp_id'], udp['id'])
        self.assertEqual(transport['encryption'], {'secret': 'pyromat_a6_udp_key'})
        self.assertIs(transport['rolling_code_enable'], True)
        self.assertEqual(transport['update_interval'], '2s')
        self.assertEqual({s['broadcast_id']: s['id'] for s in transport['sensors']}, {
            'top_live': 'foxair_wood_top_live', 'mid_live': 'foxair_wood_mid_live',
            'bottom_live': 'foxair_wood_bottom_live'})
        # Send-only transport still answers the A6's ping challenges; no local
        # provider or MQTT-dependent heartbeat can renew source temperatures.
        self.assertNotIn('providers', transport)
        self.assertNotIn('mqtt', config)
        self.assertNotIn('canbus', config)

if __name__ == '__main__':
    unittest.main()
