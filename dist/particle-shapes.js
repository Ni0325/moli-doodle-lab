// Colored outline icons: only strokes are sampled, leaving interiors transparent.
export function createShapePoints(category) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=600;
  const c=canvas.getContext('2d',{willReadFrequently:true});
  c.lineCap='round';c.lineJoin='round';
  const path=(d,color,width=5)=>{c.strokeStyle=color;c.lineWidth=width;c.stroke(new Path2D(d));};
  const circle=(x,y,r,color,width=5)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();};
  switch(category) {
    case 'apple':
      path('M300 218 C240 175 165 215 172 301 C178 398 235 457 281 428 Q300 416 319 428 C365 457 422 398 428 301 C435 215 360 175 300 218Z','#ff7189');
      path('M304 215 Q292 178 317 151','#d7a16f');
      path('M314 190 Q330 132 393 150 Q380 208 314 190Z','#8de5a0');
      path('M221 255 Q204 278 210 310','#ffb8c3',4);break;
    case 'banana':
      path('M186 185 C162 301 252 440 384 399 Q441 378 455 312 C371 379 246 297 219 185Z','#ffdb76');
      path('M203 215 C208 312 297 399 387 376','#f7b454',4);
      path('M186 185 L184 163 L210 160 L219 185 M448 320 L460 308','#c8a77d');break;
    case 'bicycle':
      circle(174,367,80,'#a7dce9');circle(426,367,80,'#a7dce9');
      path('M174 367 L244 251 L309 367 Z M174 367 L348 251 L426 367 M309 367 L348 251 L338 218 L378 218','#73d6c4');
      path('M244 251 L232 224 M210 222 L258 222 M309 367 L331 389 L350 389','#ffcf80');circle(309,367,10,'#ffcf80');break;
    case 'fish':
      path('M199 273 L119 219 Q96 300 119 381 L199 327 M185 300 C213 184 395 180 449 300 C395 420 213 416 185 300Z','#80dbed');
      path('M275 219 Q315 159 354 223 M275 381 Q316 432 354 377 M343 240 Q317 300 343 360','#69b9e8');
      circle(389,277,9,'#b5eff5');path('M408 325 L423 317','#80dbed');circle(465,219,13,'#a7eaf4',4);circle(483,175,9,'#a7eaf4',4);break;
    case 'flower':
      path('M300 329 L300 455 M296 403 Q222 406 220 346 Q280 344 296 403Z M306 371 Q367 374 381 316 Q323 316 306 371Z','#87daa3');
      for(let i=0;i<6;i++) {c.save();c.translate(300,254);c.rotate(i*Math.PI/3);path('M35 -24 C130 -80 130 80 35 24',i%2?'#ff93b4':'#f4acd6');c.restore();}
      circle(300,254,39,'#ffdb76');break;
    case 'house':
      path('M181 291 L181 438 L419 438 L419 291 M272 438 L272 338 Q300 315 328 338 L328 438','#ffe0a7');
      path('M150 279 L300 145 L450 279 M174 300 L300 188 L426 300 M351 190 L351 143 L390 143 L390 225','#ff949c');
      path('M209 314 L250 314 L250 359 L209 359Z M350 314 L391 314 L391 359 L350 359Z','#8bd8e9');circle(316,389,4,'#ffe0a7',3);break;
    case 'ice cream':
      path('M216 308 L300 467 L384 308 M238 343 L335 401 M265 324 L354 377 M359 342 L275 416 M330 324 L258 384','#eebd87',4);
      path('M201 275 C195 135 405 135 399 275 Q399 311 365 306 Q333 335 300 310 Q267 335 235 306 Q201 313 201 275Z','#ffb6cf');
      circle(300,151,19,'#ff7189');path('M300 132 Q300 119 312 115','#9bdda5',4);path('M259 225 L271 231 M326 241 L336 232','#e3b8ef',4);break;
    case 'moon':
      path('M360 166 C170 90 81 367 257 437 C329 466 409 437 445 375 C261 434 191 234 360 166Z','#ffe3a0');
      path('M415 227 L422 247 L443 254 L422 261 L415 282 L408 261 L387 254 L408 247Z','#c9b8ff',4);circle(380,174,5,'#ffe3a0',3);break;
    case 'star': {
      const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?68:155;p.push([300+Math.cos(a)*r,300+Math.sin(a)*r]);}
      path('M'+p.map(p=>p.join(' ')).join(' L')+'Z','#ffdb70');
      path('M274 265 L285 245 M355 326 L371 337','#fff1bd',4);break;
    }
    case 'sun':
      for(let i=0;i<12;i++){const a=i*Math.PI/6;path(`M${300+Math.cos(a)*129} ${300+Math.sin(a)*129} L${300+Math.cos(a)*163} ${300+Math.sin(a)*163}`,'#ffbd59');}
      circle(300,300,101,'#ffda68');path('M270 280 L270 292 M330 280 L330 292 M274 315 Q300 345 326 315','#ffe9ac',4);
      path('M240 312 L253 312 M347 312 L360 312','#ffac90',4);break;
    case 'tree':
      path('M278 351 L270 453 L330 453 L322 351 M300 375 L300 292 M300 331 L340 300 M300 308 L271 279','#d6a47f');
      path('M278 351 C166 379 125 250 207 218 C194 100 372 91 392 211 C484 247 431 377 322 351','#91dca5');
      path('M245 457 L355 457','#91dca5');break;
    case 'umbrella':
      path('M300 306 L300 412 C300 448 250 448 250 412 M300 157 L300 173','#c2b4ea');
      path('M141 306 Q155 166 300 173 Q445 166 459 306 Q419 278 378 306 Q340 277 300 306 Q260 277 222 306 Q180 278 141 306Z','#ffb4cb');
      path('M222 306 Q222 214 300 173','#8bcde8');path('M378 306 Q378 214 300 173','#c3a6ee');break;
    default:return [];
  }
  const pixels=c.getImageData(0,0,600,600).data,points=[];
  for(let y=90;y<490;y+=4)for(let x=90;x<510;x+=4){const i=(y*600+x)*4;if(pixels[i+3]>130)points.push({x,y,color:`rgb(${pixels[i]},${pixels[i+1]},${pixels[i+2]})`});}
  return points;
}
