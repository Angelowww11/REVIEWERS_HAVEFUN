(() => {
  const canvas=document.getElementById('networkCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let width=0,height=0,dots=[],raf=0,last=0,color='';
  function resize(){width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);const count=width<760?12:26;dots=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,r:Math.random()*1.8+1,v:.12+Math.random()*.18}));color=getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();}
  function enabled(){return !document.hidden&&!reduced.matches&&document.documentElement.dataset.motion!=='calm'&&!navigator.connection?.saveData;}
  function frame(now){raf=0;if(!enabled())return;raf=requestAnimationFrame(frame);if(now-last<50)return;const dt=Math.min((now-last)/50,2);last=now;ctx.clearRect(0,0,width,height);ctx.fillStyle=color;for(const p of dots){p.y-=p.v*dt;if(p.y<0)p.y=height;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}}
  function sync(){cancelAnimationFrame(raf);raf=0;ctx.clearRect(0,0,width,height);if(enabled()){last=performance.now();raf=requestAnimationFrame(frame);}}
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{resize();sync();},150);},{passive:true});
  document.addEventListener('visibilitychange',sync);addEventListener('packet:motion',sync);addEventListener('packet:theme',()=>{color=getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();});reduced.addEventListener('change',sync);resize();sync();
})();
