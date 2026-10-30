// Run: npm install --no-save jszip@3.10.1 && node tests/output-names.cjs
// Executes real conversion functions with image decoding stubbed; reads actual ZIP bytes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const JSZip=require('jszip');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const source=html.slice(html.indexOf('function uniqueOutputName('),html.indexOf('async function mergePdfs('));
const base=html.match(/function baseName\(n\)\{[^\n]+/)[0];
new vm.Script(html.split('<script>')[1].split('</script>')[0]);
let download;
const ctx=vm.createContext({JSZip,outputFormat:{value:'image/jpeg'},quality:{value:'0.9'},selectedFiles:[],
  setStatus(){},downloadBlob:(blob,name)=>download={blob,name},
  imageElement:async f=>f,drawImageToCanvas:f=>f,canvasBlob:async f=>Buffer.from(f.payload),
  heic2any:async({blob})=>blob.frames?blob.frames.map(x=>Buffer.from(x)):Buffer.from(blob.payload)});
vm.runInContext(base+'\n'+source,ctx);
async function check(kind,files,expected){
  ctx.selectedFiles=files;download=null;await ctx[kind]();
  const bytes=download.blob.arrayBuffer?await download.blob.arrayBuffer():download.blob;
  const zip=await JSZip.loadAsync(bytes),entries=Object.values(zip.files).filter(x=>!x.dir);
  assert.equal(entries.length,expected.length);
  assert.deepEqual(entries.map(x=>x.name),expected.map(x=>x[0]));
  assert.deepEqual(await Promise.all(entries.map(x=>x.async('string'))),expected.map(x=>x[1]));
}
(async()=>{
  await check('convertImages',[{name:'사진.jpg',payload:'first'},{name:'사진.png',payload:'second'}],[['사진.jpg','first'],['사진_02.jpg','second']]);
  await check('convertImages',[{name:'a_02.png',payload:'existing'},{name:'a.jpg',payload:'one'},{name:'A.png',payload:'two'}],[['a_02.jpg','existing'],['a.jpg','one'],['A_03.jpg','two']]);
  await check('convertImages',[{name:'a:b.png',payload:'one'},{name:'a?b.png',payload:'two'}],[['a_b.jpg','one'],['a_b_02.jpg','two']]);
  await check('convertHeic',[{name:'photo.heic',frames:['frame1','frame2']},{name:'photo_1.heic',payload:'still'}],[['photo_1.jpg','frame1'],['photo_2.jpg','frame2'],['photo_1_02.jpg','still']]);
  ctx.outputFormat.value='image/png';
  await check('convertHeic',[{name:'사진.heic',payload:'one'},{name:'사진.heif',payload:'two'}],[['사진.png','one'],['사진_02.png','two']]);
  ctx.outputFormat.value='image/jpeg';ctx.selectedFiles=[{name:'single.png',payload:'only'}];await ctx.convertImages();
  assert.equal(download.name,'single.jpg');assert.equal(download.blob.toString(),'only');
  console.log('PASS: ZIP entry counts and contents for duplicate extensions, case, existing suffixes, sanitized names, HEIC frames, PNG output and single-file download');
})().catch(e=>{console.error(e);process.exitCode=1});

