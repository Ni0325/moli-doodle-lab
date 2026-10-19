import {rasterize} from './features.js';
import {DoodleModel} from './model.js';
let model;
self.onmessage=async ({data})=>{
  try {
    if(data.type==='load') {
      const [metadataResponse,weightResponse]=await Promise.all([fetch('./assets/model.json'),fetch('./assets/weights.bin')]);
      if(!metadataResponse.ok||!weightResponse.ok) throw new Error('无法加载模型文件，请刷新重试');
      const metadata=await metadataResponse.json();
      model=new DoodleModel(metadata,await weightResponse.arrayBuffer());
      self.postMessage({type:'ready',metadata});
    } else if(data.type==='predict') {
      if(!model) throw new Error('模型还没有准备好');
      const start=performance.now();
      const scores=model.predict(rasterize(data.strokes));
      self.postMessage({type:'prediction',id:data.id,scores,elapsed:performance.now()-start});
    }
  } catch(error) {
    self.postMessage({type:'error',id:data.id,message:error.message});
  }
};
