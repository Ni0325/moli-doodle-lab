export class DoodleModel {
  constructor(metadata, buffer) {
    this.metadata=metadata;
    const weights=new Float32Array(buffer);
    if(weights.length!==metadata.weight_sizes.reduce((a,b)=>a+b,0)) throw new Error('模型文件不完整');
    let offset=0;
    this.weights=metadata.weight_sizes.map(size=>{
      const array=weights.subarray(offset,offset+size); offset+=size; return array;
    });
  }
  predict(input) {
    const dims=this.metadata.architecture;
    let values=input;
    for(let layer=0;layer<dims.length-1;layer++) {
      const width=dims[layer],height=dims[layer+1],w=this.weights[layer*2],b=this.weights[layer*2+1];
      const next=new Float32Array(height);
      for(let j=0;j<height;j++) {
        let sum=b[j],offset=j*width;
        for(let i=0;i<width;i++) sum+=values[i]*w[offset+i];
        next[j]=layer<dims.length-2?Math.max(0,sum):sum;
      }
      values=next;
    }
    const max=Math.max(...values);
    let total=0;
    for(let i=0;i<values.length;i++) { values[i]=Math.exp(values[i]-max); total+=values[i]; }
    return Array.from(values,v=>v/total);
  }
}
