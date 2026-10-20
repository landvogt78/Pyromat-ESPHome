"""Create a local secrets file without ever overwriting an existing one."""
import argparse
import base64
import os
from pathlib import Path
import re
import secrets

def create(destination, template):
    text = Path(template).read_text(encoding='utf-8')
    values = {'api_encryption_key': base64.b64encode(secrets.token_bytes(32)).decode('ascii')}
    for key in ['web_server_password','fallback_ap_password']:
        values[key] = secrets.token_urlsafe(24)
    for key,value in values.items():
        text,count = re.subn(rf'^{key}:.*$', f'{key}: "{value}"',text,flags=re.MULTILINE)
        if count != 1:
            raise ValueError(f'Template must contain exactly one {key}')
    # Exclusive creation is atomic: concurrent setup cannot replace credentials.
    fd = os.open(str(destination),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf-8',newline='\n') as stream:
        stream.write(text)

def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=root/'secrets.yaml')
    args = parser.parse_args()
    try:
        create(args.output,root/'secrets.example.yaml')
    except FileExistsError:
        parser.exit(1,'secrets.yaml already exists; existing credentials were preserved.\n')
    print('Local secrets file created. Edit Wi-Fi and MQTT values before flashing.')
    print('Shared API/OTA key and separate web and fallback AP passwords were generated.')

if __name__ == '__main__': main()
