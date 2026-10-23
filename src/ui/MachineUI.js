import { RECIPES } from '../systems/MachineSystem.js';
import { pixelIcon } from '../rendering/PixelAssets.js';
const label = id => id.replaceAll('_',' ');
export default class MachineUI {
  constructor(scene, machineSystem, inventorySystem) {
    Object.assign(this,{scene,machineSystem,inventorySystem});
    this._visible=false;this._machineId=null;
    this.root=document.getElementById('machine-content');
    scene.panelManager.register('machine-inspector',()=>{this._visible=false;});
    this.onClick=e=>{
      const button=e.target.closest('[data-machine-action]');if(!button)return;
      const item=button.dataset.item;
      if(button.dataset.machineAction==='deposit'){
        const have=inventorySystem.getItemCount(item),qty=e.shiftKey?have:Math.min(1,have);
        if(qty>0&&inventorySystem.removeItem(item,qty))machineSystem.deposit(this._machineId,item,qty);
      } else {
        for(const output of machineSystem.retrieve(this._machineId))inventorySystem.addItem(output.id,output.count);
      }
      this.render();scene.saveSystem.saveLocal();
    };
    this.root.addEventListener('click',this.onClick);
    this.timer=scene.time.addEvent({delay:500,loop:true,callback:()=>{if(this._visible)this.render();}});
  }
  show(id) {this._machineId=id;this._visible=true;this.lastRender=null;this.render();this.scene.panelManager.open('machine-inspector');}
  hide() {this._visible=false;if(this.scene.panelManager.current==='machine-inspector')this.scene.panelManager.close();}
  isVisible(){return this._visible;}
  render(){
    const m=this.machineSystem.getMachineState(this._machineId);if(!m){this.hide();return;}
    const signature=JSON.stringify([m,this.inventorySystem.getAllItems()]);
    if(signature===this.lastRender)return;
    this.lastRender=signature;
    const recipes=Array.isArray(RECIPES[m.type])?RECIPES[m.type]:[RECIPES[m.type]];
    const status=m.outputs.length?'Hasil siap diangkut':m.isProcessing?'Sedang bekerja':'Menunggu bahan';
    document.getElementById('machine-title').textContent=label(m.type);
    this.images ||= new Map();
    if(!this.images.has(m.type))this.images.set(m.type,this.scene.textures.get('machine_'+m.type).getSourceImage().toDataURL());
    const image=this.images.get(m.type);
    const inputs=[...new Set(recipes.flatMap(r=>Object.keys(r.inputs)))];
    const active=document.activeElement?.dataset.item;
    this.root.innerHTML='<div class="machine-portrait"><img width="96" height="96" alt="'+label(m.type)+'" src="'+image+'"><div><span class="eyebrow">STATUS LINI</span><h3>'+status+'</h3><p>'+this._machineId+'</p></div></div>'+
      '<section class="inspector-section"><h3>Proses</h3><p>'+(m.activeRecipeName||'Masukkan bahan sesuai resep.')+'</p><progress max="100" value="'+m.progress+'" aria-label="Progres produksi"></progress></section>'+
      '<section class="inspector-section"><h3>Bahan masuk</h3><div class="machine-inputs">'+inputs.map(id=>{
        const stored=m.inputs.find(i=>i.id===id)?.count||0,have=this.inventorySystem.getItemCount(id);
        return '<div class="machine-item">'+pixelIcon(id)+'<div><strong>'+label(id)+'</strong><small>Mesin '+stored+' · Tas '+have+'</small></div><button data-machine-action="deposit" data-item="'+id+'" '+(!have?'disabled':'')+'>Isi 1</button></div>';
      }).join('')+'</div><small>Shift + klik untuk memasukkan semua.</small></section>'+
      '<section class="inspector-section"><h3>Hasil produksi</h3>'+(m.outputs.length?m.outputs.map(o=>'<div class="machine-item">'+pixelIcon(o.id)+'<span>'+o.count+' × '+label(o.id)+'</span></div>').join(''):'<p>Belum ada hasil.</p>')+'<button data-machine-action="retrieve" '+(!m.outputs.length?'disabled':'')+'>Ambil hasil</button></section>'+
      '<section class="inspector-section"><h3>Resep</h3>'+recipes.map(r=>'<p>'+Object.entries(r.inputs).map(([id,n])=>n+' '+label(id)).join(' + ')+' → '+r.output.count+' '+label(r.output.id)+'</p>').join('')+'</section>';
    if(active)this.root.querySelector('[data-item="'+active+'"]')?.focus({preventScroll:true});
  }
  destroy(){this.hide();this.timer.remove();this.root.removeEventListener('click',this.onClick);}
}
