const t=Symbol(),n=(o,[e,...s])=>s.length?n(o[e],s):o[e]&&o[e][t],o=(e,s=[],i)=>(c,r=1,u=[],f=[],h)=>{const b=function(t,n,o){return o?i(c=t):c=void 0===t?c:u.reduce((o,[e,s,i])=>i?s.call(this,o)||o:e in c&&t[e]===c[e]?o:e===n?t:e in t?s.call(this,o,t[e]):o,c),i?i(c):c},l=(t,[e,l,a])=>{const[g,j,y,O,d]=e.match(/(([\w]+):)?(\s*(.+))?/),[p,m]=d.split(/[\s\.]on/),v=y||(p.startsWith("on")?p.slice(2):p).replace(/[#\.\-\[\]\(\)\"\=\^\&\/]/g,"");let w=p.startsWith("/")&&n(t,p.slice(1).split("/"));const x=!a&&p.startsWith("/");if(x)w=[],f.push([e,l,w]);else if(w)return a.forEach(t=>w.push(t)),t;const A=p.startsWith("on")?s:[].concat(s).reduce((t,n)=>[...t,...Array.from(n.querySelectorAll(p))],[]),S="function"!=typeof l&&o(l,A,t=>b({...c,[v]:t},v))(c[v]||{},r+1,w||[],f,x);u.push([v,h?function(t){$.call(this,t,!0)}:S?i:l,h]);const $=function(t,n){return t===c[v]?t:b.call(this,S?t:l.call(this,c,t),v,n)};if(m||p.startsWith("on")){const t=(m||p).replace(/(on)?(.+)/,"$2").toLowerCase();A.forEach(n=>{n.addEventListener(t,$)})}return Object.defineProperty(t,v,{get:()=>S||c[v],set:t=>$(t)[v]})},a=Object.entries(e).reduce(l,{[t]:u});return Object.defineProperty(1==r?f.reduce(l,a):a,"state",{get:()=>c})};export default o;