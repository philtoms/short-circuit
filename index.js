const t=Symbol("_REDUCERS"),e=Symbol("_BASE"),n=Symbol("_PROPAGATE"),o=(n={},[s,...i])=>"."===s?o(n,i):".."===s?o(n[e],i):s?i.length?o(n[s],i):[n[t],n[s]]:n[e]?o(n[e],[s,...i]):o(n,i),s=(i,r={})=>{const{t:c,o:a,parent:d={id:"",state:()=>y},s:f=[],i:u=[],u:l={}}=r;let{l:b,state:y={}}=r;"function"==typeof r&&(b=r);const j=(t,e,n,o,s)=>{if(t instanceof Promise)return t.then(t=>j(t,e,!1,o,s)),y;if(t===y||"object"==typeof t&&e in t&&t[e]===y[e])return t;const i=n!==u;s?y=u.reduce((n,[,o,s])=>!s&&o(t[e],u,n)||n,y):(y=t,i&&(y=u.reduce((t,[n,s,i])=>i&&n&&o.startsWith(n)?(s(void 0===t[e]?t:t[e],u),y):!n&&s(void 0,u,t)||t,y)));const r=!n&&u.find(([t,,,n])=>t===e&&n);return b&&i&&b(y,o,!!e,!!r||n),r&&r[1](void 0,!0,y),y},p=(i,[r,c,p])=>{const[,,S,,g,m]=r.match(/(([\w]+):)?(\s*([^_]+))?(_)?/),[v,_=""]=g.split("$"),E=/^[\/\.]/.test(_),O="function"!=typeof c,P=O&&Object.keys(c).some(t=>!t.startsWith("$"));if(p){const[t]=o(i,p.split("/"));return t.push([p.replace(/\./g,""),c,u]),i}const $=v,x=($||_?`${d.id}/${$||_}`:d.id||"/").replace("//","/");$&&"object"==typeof y&&!($ in y)&&(y[$]=O?{}:void 0);const A=O?s(c,{l:(t,e,n,o)=>y=j(n?{...y,[$]:t}:t,$,o,e),t:i,o:a,state:y[$]||y,parent:{id:x,j:$,state:()=>y},s:f}):{},R={id:x,j:$,p:(t,e)=>o(t.startsWith("//")&&a||i,t.split("/"))[1](e)},w=new Proxy(R,{get:(t,e)=>e in l?l[e]:R[e],set:(t,e,n)=>(l[e]=n,!0)});if("init"===_){const t=c.call(w,$?y:d.state());if(!$)return void 0!==t&&(y=t,b&&b(y,x)),i;t&&(y[$]=t[$])}const h=function(t,e,o=($?y:d.state())){const s=$||d.j;return void 0===t&&(t=o[s]),(O?A[n]:j)(O?{...o,[s]:t}:m?{...o,[s]:c.call(w,t)||o[s]}:c.call(w,o,t)||o,O&&!P?"":$,e,x,P)};if(!E&&!_||"state"===_){u.push([$,h]);const[t,e]=o(a,x.split("/"));"function"==typeof e&&(u.push([$,e,t,!0]),t.push([$,h,u,!0]))}return E&&f.push([r,h,_]),Object.entries(A).forEach(([t,e])=>h[t]=e),h[t]=A[t],h[e]=A[e],"state"!==_&&(i[S||$||_]=h),i},S=Object.entries(i).reduce(p,{[t]:u,[e]:c,[n]:j,get state(){return y},S:(t,e)=>s(t,{...e,o:S})});return d.id?S:f.reduce(p,S)};export default s;