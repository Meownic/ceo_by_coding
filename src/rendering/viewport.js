export function pixelViewport(width,height) {
  const zoom=width>=1024?2:1;
  const logicalWidth=Math.max(32,Math.min(640,Math.floor(width/zoom/32)*32));
  const logicalHeight=Math.max(32,Math.min(480,Math.floor(height/zoom/32)*32));
  return {width:logicalWidth,height:logicalHeight,zoom,cssWidth:logicalWidth*zoom,cssHeight:logicalHeight*zoom,left:Math.floor((width-logicalWidth*zoom)/2),top:Math.floor((height-logicalHeight*zoom)/2)};
}
export function hotbarLayout(width,height,zoom) {
  const columns=width*zoom<384?4:8,size=44/zoom,gap=4/zoom,rows=8/columns;
  const left=Math.floor((width-columns*(size+gap)+gap)/2),top=height-rows*(size+gap)+gap-8/zoom;
  return {size,gap,columns,positions:Array.from({length:8},(_,i)=>({x:left+i%columns*(size+gap),y:top+Math.floor(i/columns)*(size+gap)}))};
}
export function installPixelViewport(game) {
  const parent=document.getElementById('game-container');let last='';
  const resize=()=>{
    const view=pixelViewport(parent.clientWidth,parent.clientHeight),signature=JSON.stringify(view);if(signature===last)return;last=signature;
    game.registry.set('pixelZoom',view.zoom);game.scale.resize(view.width,view.height);
    game.canvas.style.width=`${view.cssWidth}px`;game.canvas.style.height=`${view.cssHeight}px`;game.canvas.style.left=`${view.left}px`;game.canvas.style.top=`${view.top}px`;
    for(const[key,value]of Object.entries({left:view.left,top:view.top,width:view.cssWidth,height:view.cssHeight}))parent.style.setProperty(`--world-${key}`,`${value}px`);
    game.events.emit('pixel-resize',view);
  };
  const observer=new ResizeObserver(resize);observer.observe(parent);resize();game.events.once('destroy',()=>observer.disconnect());
}
