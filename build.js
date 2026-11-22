// Baut index.html aus den Teilen in src/ zusammen: node build.js
// (GitHub Pages liefert die fertige index.html aus; bearbeitet wird nur in src/.)
const fs=require('fs'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,'src',p),'utf8');
const files=fs.readdirSync(path.join(__dirname,'src','js')).filter(f=>f.endsWith('.js')).sort();
const js=files.map(f=>`// ===== ${f} =====\n`+R('js/'+f)).join('\n');
const out=R('head.html')+'<style>\n'+R('style.css')+'</style>\n'+R('body.html')+'<script>\n{\n'+js+'}\n</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(__dirname,'index.html'),out);
console.log('index.html gebaut:',files.length,'JS-Teile,',out.length,'Zeichen');
