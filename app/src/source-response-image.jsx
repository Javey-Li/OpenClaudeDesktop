import React,{useEffect,useRef,useState} from 'react';
import {SourceMenu} from './source-menu.jsx';
import {responseImageTarget,imagePng} from './response-image-model.mjs';
import {useSourceToasts} from './source-toast.jsx';
import './source-response-image.css';
import {t} from '../electron/i18n/index.mjs';

export function SourceResponseImage({src,alt='',cwd,call,fallback}) {
  const toasts=useSourceToasts();
  const target=responseImageTarget(src,cwd);
  const [image,setImage]=useState(()=>target.kind==='data'?{dataUrl:target.url,name:'image'}:null);
  const [failed,setFailed]=useState(false),[ready,setReady]=useState(false),[menu,setMenu]=useState(null),[notice,setNotice]=useState(null);
  const ref=useRef(null),active=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    if(target.kind!=='file')return;
    let owned=true;
    Promise.resolve().then(()=>call('image:read',{cwd,path:target.path})).then(result=>{
      if(!owned)return;
      if(responseImageTarget(result?.dataUrl).kind==='data')setImage(result);
      else setFailed(true);
    },()=>{if(owned)setFailed(true);});
    return()=>{owned=false;};
  },[src,cwd,call]);
  const run=async(kind)=>{
    setNotice(null);
    try {
      const result=await call(`image:${kind}`,{dataUrl:kind==='copy'?imagePng(ref.current):image.dataUrl,name:image.name});
      if(active.current && (kind==='copy'?result?.copied:result?.saved)){
        const text=kind==='copy'?t('Image copied to clipboard.'):t('Image saved.');
        if(toasts)toasts.add(text);else setNotice({error:false,text});
      }
    // cfc63964b O: addError("Couldn’t copy image." mpiKUCMipZ / "Couldn’t save image." Bb7iLWtweK, {error}); the reason is logged.
    } catch(error) {if(active.current){const text=kind==='copy'?t('Couldn’t copy image.'):t('Couldn’t save image.');console.warn(text,error);if(toasts)toasts.add(text,{variant:'danger'});else setNotice({error:true,text});}}
  };
  if(target.kind==='empty')return null;
  if(failed || !['data','file'].includes(target.kind))return fallback;
  return <>
    <span className="sri-frame">
      {image && <img ref={ref} src={image.dataUrl} alt={ready?alt:''} aria-hidden={!ready || undefined} tabIndex={-1}
        className="sri-image" hidden={!ready} onLoad={()=>setReady(true)} onError={()=>setFailed(true)}
        onDragStart={event=>event.preventDefault()}
        onContextMenu={event=>{event.preventDefault();event.stopPropagation();setMenu({x:event.clientX,y:event.clientY});}}
        onKeyDown={event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey){event.preventDefault();event.stopPropagation();const rect=ref.current.getBoundingClientRect();setMenu({x:rect.left,y:rect.bottom});}}} />}
      {!ready && <span className="sri-placeholder" aria-hidden="true" />}
      {!ready && alt && <span className="source-sr-only">{alt}</span>}
    </span>
    {menu && <SourceMenu.Popup anchor={ref.current} trigger={ref.current} point={menu} dataCds="ContextMenu" layer="contextmenu" label={t("Image actions")} onClose={()=>setMenu(null)}>
      <SourceMenu.Item onClick={()=>{void run('copy');}}>{t('Copy image')}</SourceMenu.Item>
      <SourceMenu.Item onClick={()=>{void run('save');}}>{t('Save image')}</SourceMenu.Item>
    </SourceMenu.Popup>}
    {notice && <span role={notice.error?'alert':'status'} className={notice.error?'source-tool-error':'source-sr-only'}>{notice.text}</span>}
  </>;
}
