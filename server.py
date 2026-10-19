"""Local static frontend + Python inference API, no database or external API.

python3 server.py --port 8765
GET /api/health; POST /api/predict {"strokes": [[[x, y], ...], ...]}
"""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import sys
import time
from urllib.parse import urlsplit
import numpy as np

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'ml'))
from features import rasterize


def validate_strokes(value):
    if not isinstance(value,list) or len(value)>200:
        raise ValueError('strokes 必须是最多 200 条笔画的列表')
    count=0
    for stroke in value:
        if not isinstance(stroke,list): raise ValueError('笔画格式不正确')
        count+=len(stroke)
        if count>12000: raise ValueError('笔画点数过多')
        for point in stroke:
            if not isinstance(point,list) or len(point)!=2:
                raise ValueError('每个坐标需要 x、y 两个数')
            if any(isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) or abs(v)>100000 for v in point):
                raise ValueError('坐标必须是有效的有限数值')
    return value


class Model:
    def __init__(self):
        self.metadata=json.loads((ROOT/'dist/assets/model.json').read_text())
        data=np.fromfile(ROOT/'dist/assets/weights.bin',dtype='<f4')
        self.weights=[]
        offset=0
        for i,size in enumerate(self.metadata['weight_sizes']):
            array=data[offset:offset+size]
            if i%2==0:
                dims=self.metadata['architecture']
                array=array.reshape(dims[i//2+1],dims[i//2]).T
            self.weights.append(array)
            offset+=size
        if len(data)!=offset: raise ValueError('Invalid weight file')

    def predict(self,strokes):
        values=rasterize(strokes)
        for i in range(3):
            values=values@self.weights[2*i]+self.weights[2*i+1]
            if i<2: values=np.maximum(values,0)
        exp=np.exp(values-values.max())
        return (exp/exp.sum()).tolist()


class Handler(SimpleHTTPRequestHandler):
    model=None
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)

    def send_json(self,status,data):
        body=json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path=='/api/health':
            self.send_json(200,{'ready':True,'engine':'python','metadata':self.model.metadata})
        else: super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path!='/api/predict':
            self.send_json(404,{'error':'接口不存在'}); return
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length<=0 or length>262144:
                self.send_json(413,{'error':'请求数据为空或过大'}); return
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict): raise ValueError('请求需要 JSON 对象')
            strokes=validate_strokes(body.get('strokes'))
            length=sum(math.hypot(b[0]-a[0],b[1]-a[1]) for s in strokes for a,b in zip(s[:-1],s[1:]))
            if length<.001:
                self.send_json(422,{'error':'请先画出一些线条'}); return
            start=time.perf_counter()
            scores=self.model.predict(strokes)
            self.send_json(200,{'scores':scores,'elapsed':(time.perf_counter()-start)*1000})
        except (ValueError,TypeError,json.JSONDecodeError) as error:
            self.send_json(400,{'error':str(error)})


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--host',default='127.0.0.1')
    args=parser.parse_args()
    Handler.model=Model()
    httpd=ThreadingHTTPServer((args.host,args.port),Handler)
    print(f'Moli Doodle Lab: http://{args.host}:{args.port} (Python inference)',flush=True)
    try: httpd.serve_forever()
    except KeyboardInterrupt: httpd.server_close()
