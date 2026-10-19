// Keep this algorithm synchronized with ml/features.py (verified by parity tests).
export function rasterize(strokes) {
  const pixels = new Float32Array(784);
  const points = strokes.flat();
  if (!points.length) return pixels;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const [x,y] of points) {
    minX=Math.min(minX,x); minY=Math.min(minY,y);
    maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
  }
  const width=maxX-minX, height=maxY-minY, span=Math.max(width,height);
  if (span < .001) return pixels;
  const scale=21/span, ox=(27-width*scale)/2, oy=(27-height*scale)/2;
  for (const stroke of strokes) {
    for(let i=1;i<stroke.length;i++) {
      const ax=(stroke[i-1][0]-minX)*scale+ox, ay=(stroke[i-1][1]-minY)*scale+oy;
      const bx=(stroke[i][0]-minX)*scale+ox, by=(stroke[i][1]-minY)*scale+oy;
      const dx=bx-ax,dy=by-ay,den=Math.max(dx*dx+dy*dy,1e-8);
      const left=Math.max(0,Math.floor(Math.min(ax,bx)-1.4)),right=Math.min(27,Math.ceil(Math.max(ax,bx)+1.4));
      const top=Math.max(0,Math.floor(Math.min(ay,by)-1.4)),bottom=Math.min(27,Math.ceil(Math.max(ay,by)+1.4));
      for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
        const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/den));
        const value=Math.max(0,Math.min(1,1.35-Math.hypot(x-ax-t*dx,y-ay-t*dy)));
        pixels[y*28+x]=Math.max(pixels[y*28+x],value);
      }
    }
  }
  return pixels;
}

export function inkLength(strokes) {
  let length=0;
  for(const stroke of strokes) for(let i=1;i<stroke.length;i++) length+=Math.hypot(stroke[i][0]-stroke[i-1][0],stroke[i][1]-stroke[i-1][1]);
  return length;
}
