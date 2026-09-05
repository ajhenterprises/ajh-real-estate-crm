'use client';
import {useState} from 'react';
import {Row,mileageTypes,mileageMatches} from '@/lib/model';

export function MileageFields({value,rows}:{value:Record<string,any>;rows:Row[]}){
 const [type,setType]=useState(value.linkedType||'');
 const [linked,setLinked]=useState(value.linkedId||'');
 const candidates=rows.filter(r=>mileageMatches(type,r));
 return <>
  <label className="wide">Business purpose *<input name="name" required defaultValue={value.name||''}/></label>
  <label>Date *<input name="date" type="date" required defaultValue={value.date||''}/></label>
  <label>Miles *<input name="miles" type="number" min="0" step="0.01" required defaultValue={value.miles??''}/></label>
  <label>From *<input name="from" required defaultValue={value.from||''}/></label>
  <label>To *<input name="to" required defaultValue={value.to||''}/></label>
  <label>Business activity<select name="linkedType" value={type} onChange={e=>{setType(e.target.value);setLinked('');}}><option value="">General business travel</option>{mileageTypes.map(t=><option key={t}>{t}</option>)}</select></label>
  <label>Attach to existing record<select name="linkedId" value={linked} disabled={!type} onChange={e=>setLinked(e.target.value)}><option value="">No linked record</option>{candidates.map(r=><option value={r.id} key={r.id}>{r.data.name}{r.data.date?' · '+r.data.date:''}</option>)}</select></label>
  {type&&!linked&&<label className="wide">{type==='Meeting'||type==='Training'?type+' name':'Activity name'} (optional)<input name="activityName" defaultValue={value.activityName||''} placeholder="For an activity that isn't already in your CRM"/></label>}
  {type&&!candidates.length&&<p className="muted wide">No matching records yet. You can describe the activity above, or create it in Activities or Showings and link it later.</p>}
  <label className="wide">Notes<textarea name="notes" rows={4} defaultValue={value.notes||''}/></label>
 </>;
}
