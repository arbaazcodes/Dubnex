import asyncio
import json
import requests
import websockets

BASE = 'http://127.0.0.1:8000'

print('GET / ->', requests.get(BASE + '/').status_code, requests.get(BASE + '/').text)

r1 = requests.post(BASE + '/api/detect-language', json={'filename': 'sample.mp4'})
print('POST /api/detect-language ->', r1.status_code, r1.text)

r2 = requests.post(BASE + '/api/chat', json={'message': 'hello'})
print('POST /api/chat ->', r2.status_code, r2.text)

r3 = requests.post(BASE + '/api/analyze-video', json={'title': 'demo', 'duration': '00:30'})
print('POST /api/analyze-video ->', r3.status_code, r3.text)

r4 = requests.post(BASE + '/api/transcribe-audio', json={'audio': 'abc123', 'mimeType': 'audio/webm'})
print('POST /api/transcribe-audio ->', r4.status_code, r4.text)

rs = requests.get(BASE + '/api/pipeline-sse', params={'jobId': 'abc'}, stream=True)
print('GET /api/pipeline-sse ->', rs.status_code, rs.headers.get('content-type'))
print('SSE first line ->', next(rs.iter_lines()).decode())

opt = requests.options(BASE + '/api/detect-language', headers={'Origin': 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'POST'})
print('OPTIONS /api/detect-language ->', opt.status_code, opt.headers.get('access-control-allow-origin'), opt.headers.get('access-control-allow-methods'))

async def main():
    async with websockets.connect('ws://127.0.0.1:8000/live') as ws:
        await ws.send('ping')
        print('WS /live ->', await ws.recv())

asyncio.run(main())

files = {'file': ('demo.mp4', b'not-a-real-video', 'video/mp4')}
data = {'target_lang': 'English', 'voice': 'george'}
r5 = requests.post(BASE + '/process-video', files=files, data=data)
print('POST /process-video ->', r5.status_code, r5.text)
