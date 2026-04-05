const express=require('express'),path=require('path'),initSqlJs=require('sql.js'),fs=require('fs');
const app=express();app.use(express.json());
const DB_PATH=path.join(__dirname,'oxo-data.sqlite');let db;

async function initDB(){
  const SQL=await initSqlJs();
  db=fs.existsSync(DB_PATH)?new SQL.Database(fs.readFileSync(DB_PATH)):new SQL.Database();
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  const ti=db.exec("PRAGMA table_info(archetypes)");
  const cols=ti.length>0?ti[0].values.map(r=>r[1]):[];
  if(cols.length>0&&!cols.includes('tshirt'))db.run('DROP TABLE archetypes');
  if(cols.length>0&&cols.includes('tshirt')){
    const mig=[['benchmark_low','REAL',0],['benchmark_high','REAL',0],['founder_focus','INTEGER',0],['tooling_cost','REAL',0],['tooling_delivery_pct','REAL',0],['tooling_win_pct','REAL',0],['tooling_threshold','REAL',0],['tooling_built','INTEGER',0]];
    mig.forEach(function(m){if(!cols.includes(m[0]))try{db.run('ALTER TABLE archetypes ADD COLUMN '+m[0]+' '+m[1]+' DEFAULT '+m[2])}catch(e){}});
  }
  db.run(`CREATE TABLE IF NOT EXISTS archetypes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,tshirt TEXT DEFAULT 'M',description TEXT DEFAULT '',
    project_length_months INTEGER DEFAULT 6,oxo_team_size INTEGER DEFAULT 2,client_team_size INTEGER DEFAULT 10,
    kickoff_days INTEGER DEFAULT 2,offsite_days INTEGER DEFAULT 2,closing_days INTEGER DEFAULT 1,
    kickoff_venue_pp_day REAL DEFAULT 350,offsite_venue_pp_day REAL DEFAULT 400,closing_venue_pp_day REAL DEFAULT 350,
    checkin_travel REAL DEFAULT 150,workshop_travel REAL DEFAULT 200,workshop_materials REAL DEFAULT 300,
    pricing_model TEXT DEFAULT 'outcome_fixed',
    estimated_client_upside REAL DEFAULT 500000,upside_pricing_pct REAL DEFAULT 15,
    base_fee REAL DEFAULT 40000,gain_share_pct REAL DEFAULT 8,gain_share_probability REAL DEFAULT 65,
    benchmark_low REAL DEFAULT 30000,benchmark_high REAL DEFAULT 100000,
    founder_focus INTEGER DEFAULT 0,
    tooling_cost REAL DEFAULT 0,tooling_delivery_pct REAL DEFAULT 0,tooling_win_pct REAL DEFAULT 0,
    tooling_threshold REAL DEFAULT 0,tooling_built INTEGER DEFAULT 0,
    year1_count REAL DEFAULT 0,year2_count REAL DEFAULT 0,year3_count REAL DEFAULT 0,year4_count REAL DEFAULT 0,year5_count REAL DEFAULT 0
  )`);
  const D={founders:'3',founder_salary:'10000',senior_consultants:'2',senior_salary:'7000',junior_consultants:'2',junior_salary:'5000',operations:'1',ops_salary:'3500',
    office_pp:'500',tech_pp:'800',travel_pp:'1000',insurance:'400',initial_capital:'250000',
    founder_sales_target:'2000000',senior_sales_target:'1000000',director_sales_target:'1500000',director_salary:'9000',starting_directors:'0',
    founder_specializations:'3',senior_specializations:'1',
    bd_days_new:'12',bd_days_repeat:'4',bd_days_referral:'6',
    win_rate_new:'30',win_rate_repeat:'70',win_rate_referral:'50',repeat_rate:'35',referral_rate:'20',
    junior_billability:'80',admin_ratio:'6',senior_hire_salary:'7000',junior_hire_salary:'5000',
    working_days:'220',founder_mgmt_pct:'30',founder_checkin_days:'2',
    senior_bonus_meet:'5',senior_bonus_exceed:'10',senior_bonus_exceed_threshold:'150',
    director_bonus_meet:'7',director_bonus_exceed:'12',
    junior_bonus_meet:'10',junior_bonus_exceed:'20',junior_exceed_threshold:'120',
    founder_profit_share:'5',
    marketing_conservative:'3000',marketing_base:'5000',marketing_aggressive:'8000',
    sim_seed:'42',hiring_months:'3',hiring_bandwidth:'25'};
  for(const[k,v]of Object.entries(D))db.run('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)',[k,v]);
  const cnt=db.exec('SELECT COUNT(*) FROM archetypes');
  if(cnt.length&&cnt[0].values[0][0]===0){
    [['Leadership Alignment Sprint','S',2,2,6,650000,9,30000,100000,1],['Vision & Strategy Offsite','S',1,2,8,800000,12,25000,50000,1],['Culture Diagnostic & Reset','M',4,2,12,600000,14,50000,90000,0],['Change Management Program','L',9,3,15,1650000,17,105000,420000,0],['Post-Merger Integration','L',6,4,12,3100000,10,100000,610000,0],['AI Readiness & Adoption','M',3,2,10,1050000,15,50000,90000,0],['Team Performance Accelerator','S',3,1,8,700000,11,20000,90000,0],['Leadership Development Program','M',6,2,10,950000,15,55000,100000,1],['Organizational Restructure','L',8,3,14,2650000,11,100000,440000,1],['Innovation Sprint & Prototyping','S',2,2,8,500000,9,30000,60000,1],['AI Tool Scope and Roll out','M',12,3,10,2950000,15,85000,500000,0]]
    .forEach(c=>db.run('INSERT INTO archetypes (name,tshirt,project_length_months,oxo_team_size,client_team_size,pricing_model,estimated_client_upside,upside_pricing_pct,benchmark_low,benchmark_high,founder_focus) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [c[0],c[1],c[2],c[3],c[4],'outcome_fixed',c[5],c[6],c[7],c[8],c[9]]));
  }
  save();
}
function save(){fs.writeFileSync(DB_PATH,Buffer.from(db.export()))}
app.get('/api/settings',(q,r)=>{const x=db.exec('SELECT key,value FROM settings');const o={};if(x.length)x[0].values.forEach(([k,v])=>o[k]=v);r.json(o)});
app.put('/api/settings',(q,r)=>{for(const[k,v]of Object.entries(q.body))db.run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)',[k,String(v)]);save();r.json({ok:1})});
app.get('/api/archetypes',(q,r)=>{const x=db.exec('SELECT * FROM archetypes ORDER BY id');if(!x.length)return r.json([]);const c=x[0].columns;r.json(x[0].values.map(row=>{const o={};c.forEach((k,i)=>o[k]=row[i]);return o}))});
app.post('/api/archetypes',(q,r)=>{const o=q.body;db.run('INSERT INTO archetypes (name,tshirt,project_length_months,oxo_team_size,client_team_size,pricing_model,estimated_client_upside,upside_pricing_pct,base_fee,gain_share_pct,gain_share_probability,benchmark_low,benchmark_high,founder_focus,tooling_cost,tooling_delivery_pct,tooling_win_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  [o.name||'New',o.tshirt||'M',o.project_length_months||6,o.oxo_team_size||2,o.client_team_size||10,o.pricing_model||'outcome_fixed',o.estimated_client_upside||500000,o.upside_pricing_pct||15,o.base_fee||40000,o.gain_share_pct||8,o.gain_share_probability||65,o.benchmark_low||30000,o.benchmark_high||100000,o.founder_focus||0,o.tooling_cost||0,o.tooling_delivery_pct||0,o.tooling_win_pct||0]);
  save();r.json({id:db.exec('SELECT last_insert_rowid()')[0].values[0][0]})});
app.put('/api/archetypes/:id',(q,r)=>{const o=q.body,f=Object.keys(o).filter(k=>k!=='id');if(!f.length)return r.json({ok:1});db.run('UPDATE archetypes SET '+f.map(k=>k+' = ?').join(', ')+' WHERE id = ?',[...f.map(k=>o[k]),q.params.id]);save();r.json({ok:1})});
app.delete('/api/archetypes/:id',(q,r)=>{db.run('DELETE FROM archetypes WHERE id = ?',[q.params.id]);save();r.json({ok:1})});
app.use(express.static(path.join(__dirname,'public')));
app.get('*',(q,r)=>r.sendFile(path.join(__dirname,'public','index.html')));
initDB().then(()=>{const P=process.env.PORT||3000;app.listen(P,()=>console.log('\n  OxO v13 → http://localhost:'+P+'\n'))});
