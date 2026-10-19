"""Integration checks against a running local server."""
import json
from pathlib import Path
import unittest
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8765'

def post(body,path='/api/predict'):
    request=urllib.request.Request(BASE+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=5) as response:
            return response.status,json.load(response)
    except urllib.error.HTTPError as error:
        return error.code,json.load(error)

class API(unittest.TestCase):
    def test_prediction_matches_training_export(self):
        fixtures=json.loads((ROOT/'tests/fixtures.json').read_text())
        for fixture in fixtures:
            status,result=post({'strokes':fixture['strokes']})
            self.assertEqual(status,200)
            self.assertLess(max(abs(a-b) for a,b in zip(result['scores'],fixture['probabilities'])),.0001)

    def test_invalid_input(self):
        for body in [None,{'strokes':None},{'strokes':[[[True,2]]]},{'strokes':[[['x',2]]]},{'strokes':[[]]*201}]:
            self.assertEqual(post(body)[0],400)

    def test_blank_input(self):
        self.assertEqual(post({'strokes':[]})[0],422)
        self.assertEqual(post({'strokes':[[[1,1],[1,1]]]})[0],422)

    def test_unknown_route(self):
        self.assertEqual(post({},'/api/missing')[0],404)

if __name__=='__main__':unittest.main()
