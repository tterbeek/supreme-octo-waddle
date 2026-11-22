import{adb,delay}from'./webview-driver.mjs';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
export function nodes(){adb('shell','uiautomator','dump','/sdcard/movenotes-media.xml');const xml=adb('shell','cat','/sdcard/movenotes-media.xml').toString();return[...xml.matchAll(/<node\s+([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],decode(a[2])])));}
export async function tapText(label){const n=nodes().find(n=>(n.text||'').toLowerCase()===label.toLowerCase()||(n['content-desc']||'').toLowerCase()===label.toLowerCase());if(!n)throw Error('Android control missing: '+label);const[x1,y1,x2,y2]=n.bounds.match(/\d+/g).map(Number);adb('shell','input','tap',String((x1+x2)/2),String((y1+y2)/2));await delay(350);}
export function labels(){return nodes().filter(n=>n.text||n['content-desc']).map(n=>({text:n.text,label:n['content-desc'],bounds:n.bounds}));}
