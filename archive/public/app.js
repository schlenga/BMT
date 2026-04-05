var S={},archs=[],selArch=null,scenario=1,panels={arch:false,costs:false},openYears={0:true};
var SCS=[{name:'Conservative',label:'100%',salesMult:1.0,mktKey:'marketing_conservative'},{name:'Base Case',label:'110%',salesMult:1.1,mktKey:'marketing_base'},{name:'Aggressive',label:'120%',salesMult:1.2,mktKey:'marketing_aggressive'}];
var NYRS=10,YRS=[];for(var _i=1;_i<=NYRS;_i++)YRS.push('Y'+_i);
function load(){return Promise.all([fetch('/api/settings').then(function(r){return r.json()}),fetch('/api/archetypes').then(function(r){return r.json()})]).then(function(res){S={};for(var k in res[0])S[k]=parseFloat(res[0][k])||0;archs=res[1];render()})}
function savS(k,v){S[k]=parseFloat(v);fetch('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries([[k,v]]))})}
function savA(o){fetch('/api/archetypes/'+o.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)})}
function newA(){fetch('/api/archetypes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'New Type'})}).then(function(r){return r.json()}).then(function(r){return load().then(function(){selArch=r.id;panels.arch=true;render()})})}
function delA(id){if(!confirm('Delete?'))return;fetch('/api/archetypes/'+id,{method:'DELETE'}).then(function(){if(selArch===id)selArch=null;load()})}
function mkRng(seed){var s=seed||42;return function(){s=(s*16807)%2147483647;return(s-1)/2147483646}}
function pCost(a){var mo=a.project_length_months||6,ot=a.oxo_team_size||2,ct=a.client_team_size||10,tot=ot+ct;var kick=tot*(a.kickoff_venue_pp_day||350)*(a.kickoff_days||2);var chk=Math.round(mo*4.33)*(a.checkin_travel||150);var ws=mo*(ot*(a.workshop_travel||200)+(a.workshop_materials||300));var osCnt=Math.max(1,Math.floor(mo/3)),osPpl=ot+Math.ceil(ct*.5);var os=osCnt*osPpl*(a.offsite_venue_pp_day||400)*(a.offsite_days||2);var cl=tot*(a.closing_venue_pp_day||350)*(a.closing_days||1);return{direct:kick+chk+ws+os+cl,days:ot*mo*15}}
function pPrice(a){var up=a.estimated_client_upside||0;if(a.pricing_model==='base_plus_upside'){var b=a.base_fee||0,gs=up*(a.gain_share_pct||0)/100*(a.gain_share_probability||0)/100;return{rev:b+gs,guar:b,vari:gs,label:'B+U'}}var fp=up*(a.upside_pricing_pct||15)/100;return{rev:fp,guar:fp,vari:0,label:'Fixed'}}
function tLoad(t){return t==='S'?1/3:t==='M'?1/2:1}
function talentTier(){
  // Blended annual comp: average of director/senior + juniors in a typical team (2-person: 1sr+1jr)
  var srComp=(S.senior_salary||7000)*12*1.05;var dirComp=(S.director_salary||9000)*12*1.05;var jrComp=(S.junior_salary||5000)*12*1.1;
  var blended=(Math.max(srComp,dirComp)+jrComp)/2; // avg of leader + junior
  if(blended>=120000)return{name:'Elite',mult:1.2,color:'#af52de'};
  if(blended>=90000)return{name:'Premium',mult:1.0,color:'#0071e3'};
  if(blended>=65000)return{name:'Mid-Market',mult:0.85,color:'#34c759'};
  return{name:'Entry',mult:0.65,color:'#ff9f0a'};
}
function talentPriceBand(){var t=talentTier();return{low:t.mult*0.7,high:t.mult*1.15,tier:t}}
function engEcon(a){var pr=pPrice(a),pc=pCost(a),mo=a.project_length_months||6;var eff=(a.tooling_delivery_pct||0)/100;var staff=(S.senior_salary||7000)*mo+Math.max(0,(a.oxo_team_size||2)-1)*(S.junior_salary||5000)*mo;var adjD=pc.direct*(1-eff);var profit=pr.rev-adjD-staff;return{rev:pr.rev,guar:pr.guar,vari:pr.vari,label:pr.label,direct:adjD,staff:staff,profit:profit,margin:pr.rev>0?profit/pr.rev*100:0}}
function pricePos(a){var pr=pPrice(a),l=a.benchmark_low||0,h=a.benchmark_high||0;if(!l||!h||l>=h)return 0;return(pr.rev-(l+h)/2)/(h-l)*2}
function priceWinMult(a){
  var pos=pricePos(a);
  var base=Math.max(0.5,Math.min(1.5,1-pos*0.3)); // below mkt=easier, above=harder
  // Talent penalty: if price is ABOVE what talent comp justifies, penalty
  var tb=talentPriceBand(),pr=pPrice(a),mid=((a.benchmark_low||0)+(a.benchmark_high||0))/2;
  if(mid>0){var ratio=pr.rev/mid;if(ratio>tb.high){base*=Math.max(0.5,tb.high/ratio)}} // overpriced for talent
  return base;
}
function priceInTalentBand(a){var pr=pPrice(a),mid=((a.benchmark_low||0)+(a.benchmark_high||0))/2;if(mid<=0)return true;var tb=talentPriceBand();return pr.rev/mid>=tb.low&&pr.rev/mid<=tb.high}

/*
  SIMULATION ENGINE v13
  - 10 years
  - Roles: Founder, Director (promoted Sr), Senior, Junior
  - Hiring: 3mo, costs 25% bandwidth, max parallel hires per role
  - Directors emerge after 3 consecutive years meeting target
  - Deals queue if no leader available (wait for hire)
*/
function sim(){
  var sc=SCS[scenario],rng=mkRng(S.sim_seed||42);
  function pick(arr,n){var r=[],pool=arr.slice();for(var i=0;i<Math.min(n,pool.length);i++){var idx=Math.floor(rng()*pool.length);r.push(pool.splice(idx,1)[0])}return r}
  var workD=S.working_days||220;
  var fTarget=(S.founder_sales_target||2e6)*sc.salesMult;
  var sTarget=(S.senior_sales_target||1e6)*sc.salesMult;
  var dTarget=(S.director_sales_target||1.5e6)*sc.salesMult;
  var sSpecs=S.senior_specializations||1;
  var bWrN=(S.win_rate_new||30)/100,bWrRp=(S.win_rate_repeat||70)/100,bWrRf=(S.win_rate_referral||50)/100;
  var repR=(S.repeat_rate||35)/100,refR=(S.referral_rate||20)/100;
  var bdN=S.bd_days_new||12,bdRp=S.bd_days_repeat||4,bdRf=S.bd_days_referral||6;
  var fMgmt=(S.founder_mgmt_pct||30)/100,fChk=S.founder_checkin_days||2;
  var ppOH=(S.office_pp||0)+(S.tech_pp||0)+(S.travel_pp||0);
  var mkt=S[sc.mktKey]||S.marketing_base||5000,fixOH=(S.insurance||0)+mkt,adminR=S.admin_ratio||6;
  var mktBoost=1+Math.max(0,mkt-3000)/20000;
  var hireMo=S.hiring_months||3,hireBW=(S.hiring_bandwidth||25)/100;

  var nF=S.founders||3,nJ=S.junior_consultants||2,nO=S.operations||1,cumCash=S.initial_capital||0;
  var nStartDir=S.starting_directors||0;
  var starredArchs=archs.filter(function(a){return a.founder_focus});
  if(!starredArchs.length)starredArchs=archs;

  // People: seniors, directors (including starting directors)
  var people=[];
  for(var i=0;i<nStartDir;i++){
    people.push({id:'D'+(i+1),role:'Director',specs:pick(archs,sSpecs).map(function(a){return a.id}),load:0,sold:0,deals:0,managed:[],yearsMetTarget:3,hiringSlots:{sr:0,jr:0},hiringBW:0});
  }
  for(var i=0;i<(S.senior_consultants||2);i++){
    people.push({id:'S'+(i+1),role:'Senior',specs:pick(archs,sSpecs).map(function(a){return a.id}),load:0,sold:0,deals:0,managed:[],yearsMetTarget:0,hiringSlots:{sr:0,jr:0},hiringBW:0});
  }
  var founders=[];
  for(var i=0;i<nF;i++){
    founders.push({id:'F'+(i+1),specs:starredArchs.map(function(a){return a.id}),sold:0,deals:0,hiringSlots:{sr:0},hiringBW:0});
  }
  // Track junior performance for promotion: {yearsMetTarget:0}
  var juniorPerf={yearsMetTarget:0};

  var activeEngs=[],nxId=1,years=[],toolingDone={};
  var hiringQueue=[];
  // Deal queue: won deals waiting for a leader (max 3 months)
  var dealQueue=[]; // {deal, monthsLeft}

  for(var y=0;y<NYRS;y++){
    var ys=y*12,ye=(y+1)*12,toolingSpend=0;
    var hiredSrThisYear=0,hiredJrThisYear=0,promotedThisYear=0;

    // === Process hiring queue: decrement months, complete hires ===
    var newHires=[];
    hiringQueue=hiringQueue.filter(function(h){
      h.monthsLeft-=12; // simplification: each year processes 12 months
      if(h.monthsLeft<=0){
        if(h.type==='senior'){
          var ns={id:'S'+(people.length+1)+'y'+(y+1),role:'Senior',specs:h.specIds||pick(archs,sSpecs).map(function(a){return a.id}),load:0,sold:0,deals:0,managed:[],yearsMetTarget:0,hiringSlots:{sr:0,jr:0},hiringBW:0};
          people.push(ns);hiredSrThisYear++;newHires.push(ns);
        }else{nJ++;hiredJrThisYear++}
        // Free up hirer's slot
        var hirer=founders.find(function(f){return f.id===h.hirerId})||people.find(function(p){return p.id===h.hirerId});
        if(hirer){if(h.type==='senior'&&hirer.hiringSlots)hirer.hiringSlots.sr=Math.max(0,hirer.hiringSlots.sr-1);if(h.type==='junior'&&hirer.hiringSlots)hirer.hiringSlots.jr=Math.max(0,hirer.hiringSlots.jr-1)}
        return false;
      }
      return true;
    });

    // === Update engagement loads ===
    activeEngs=activeEngs.filter(function(e){return e.endMonth>ys});
    people.forEach(function(p){
      p.load=0;p.sold=0;p.deals=0;p.managed=[];
      // Hiring bandwidth: count active hires
      var activeHires=hiringQueue.filter(function(h){return h.hirerId===p.id}).length;
      p.hiringBW=activeHires>0?hireBW*Math.min(activeHires,3):0;
      activeEngs.filter(function(e){return e.seniorId===p.id}).forEach(function(e){
        p.load+=tLoad(e.tshirt)*Math.max(0,Math.min(e.endMonth,ye)-Math.max(e.startMonth,ys))/12;
        p.managed.push(e);
      });
    });
    // Founder hiring bandwidth
    founders.forEach(function(f){
      var ah=hiringQueue.filter(function(h){return h.hirerId===f.id}).length;
      f.hiringBW=ah>0?hireBW*Math.min(ah,2):0;
      f.sold=0;f.deals=0;
    });

    // === Promotions: Senior → Director after 3 consecutive years meeting target ===
    people.forEach(function(p){
      if(p.role==='Senior'&&p.yearsMetTarget>=3){
        p.role='Director';promotedThisYear++;
      }
    });

    // === SELLING ===
    var actCnt=activeEngs.filter(function(e){return e.endMonth>ys&&e.startMonth<ye}).length;
    var pipe=[];

    function sellLoop(seller,target,availDays,maxAtt){
      var my=seller.specs.map(function(id){return archs.find(function(a){return a.id===id})}).filter(Boolean);
      if(!my.length)return;
      var dl=availDays,att=0;
      while(seller.sold<target&&dl>0&&att<maxAtt){
        var a=my[Math.floor(rng()*my.length)],pr=pPrice(a);
        if(pr.rev<=0){att++;continue}
        var roll=rng(),isRep=roll<repR,isRef=!isRep&&roll<repR+refR;
        var bwr=isRep?bWrRp:isRef?bWrRf:bWrN;
        var toolWB=toolingDone[a.id]&&a.tooling_win_pct?(a.tooling_win_pct/100):0;
        var wr=Math.min(bwr*mktBoost*priceWinMult(a)*(1+toolWB),.95);
        var bd=isRep?bdRp:isRef?bdRf:bdN;
        if(dl<bd)break;dl-=bd;
        if(rng()<wr){
          var pc=pCost(a),eff=toolingDone[a.id]&&a.tooling_delivery_pct?(a.tooling_delivery_pct/100):0;
          pipe.push({id:nxId++,archId:a.id,archName:a.name,tshirt:a.tshirt||'M',revenue:pr.rev,guar:pr.guar,vari:pr.vari,direct:pc.direct*(1-eff),durationMonths:a.project_length_months||6,oxoTeam:a.oxo_team_size||2,soldBy:seller.id});
          seller.sold+=pr.rev;seller.deals++;
        }
        att++;
      }
    }

    // Founders sell (priority 1)
    founders.forEach(function(f){
      var availD=workD*(1-fMgmt)*(1-f.hiringBW)-fChk*Math.min(12,actCnt)/nF;
      sellLoop(f,fTarget,Math.max(0,availD),80);
    });

    // Directors sell (priority 1 for them too)
    people.filter(function(p){return p.role==='Director'}).forEach(function(d){
      var free=Math.max(0,1-d.load);
      var availD=workD*free*(1-d.hiringBW);
      sellLoop(d,dTarget*free,Math.max(0,availD),60);
    });

    // Seniors sell remaining bandwidth
    people.filter(function(p){return p.role==='Senior'}).forEach(function(s){
      var free=Math.max(0,1-s.load);
      if(free<.1)return;
      var availD=workD*free*0.5*(1-s.hiringBW);
      sellLoop(s,sTarget*free,Math.max(0,availD),40);
    });

    // === STAFFING: assign pipeline + deal queue to leaders ===
    // First, try to staff deals from the queue (carried from last year, 3mo timeout)
    dealQueue=dealQueue.filter(function(dq){dq.monthsLeft-=12;return dq.monthsLeft>0}); // drop expired
    var allDeals=dealQueue.map(function(dq){return dq.deal}).concat(pipe);
    allDeals.sort(function(a,b){return b.revenue-a.revenue});
    dealQueue=[];
    var staffed=[],unstaffedThisYear=[];

    allDeals.forEach(function(d){
      var ld=tLoad(d.tshirt),sm=d.startMonth||ys+Math.floor(rng()*6),em=sm+d.durationMonths;
      if(!d.startMonth){d.startMonth=sm;d.endMonth=em}
      var yl=ld*Math.max(0,Math.min(em,ye)-Math.max(sm,ys))/12;
      if(yl<=0)return; // engagement already ended
      var assigned=false;
      for(var pass=0;pass<2&&!assigned;pass++){
        for(var i=0;i<people.length;i++){
          var p=people[i];
          var specMatch=pass===0?p.specs.indexOf(d.archId)>=0:true;
          if(specMatch&&p.load+yl<=1.01){
            p.load+=yl;if(pass===1)p.specs.push(d.archId);
            d.seniorId=p.id;p.managed.push(d);activeEngs.push(d);staffed.push(d);assigned=true;break;
          }
        }
      }
      if(!assigned){
        // Try promoting a junior → senior (instant) if junior has met target 3 years
        if(juniorPerf.yearsMetTarget>=3&&nJ>0){
          var ns={id:'S'+(people.length+1)+'p'+(y+1),role:'Senior',specs:[d.archId],load:yl,sold:0,deals:0,managed:[d],yearsMetTarget:0,hiringSlots:{sr:0,jr:0},hiringBW:0};
          people.push(ns);d.seniorId=ns.id;activeEngs.push(d);staffed.push(d);
          promotedThisYear++;nJ--; // promoted, need backfill
          // Queue junior backfill
          var jrHirer=people.find(function(p){return(p.role==='Director'||p.role==='Senior')&&hiringQueue.filter(function(q){return q.hirerId===p.id&&q.type==='junior'}).length<(p.role==='Director'?3:1)});
          if(jrHirer)hiringQueue.push({type:'junior',monthsLeft:hireMo,hirerId:jrHirer.id});
          assigned=true;
        }
      }
      if(!assigned){
        // Queue deal for 3 months, trigger senior hire
        dealQueue.push({deal:d,monthsLeft:hireMo});
        unstaffedThisYear.push(d);
      }
    });

    // === HIRING: triggered by unstaffed deals ===
    unstaffedThisYear.forEach(function(d){
      var hirers=founders.concat(people.filter(function(p){return p.role==='Director'}));
      for(var i=0;i<hirers.length;i++){
        var h=hirers[i];
        var maxSr=2;
        var currentSrHires=hiringQueue.filter(function(q){return q.hirerId===h.id&&q.type==='senior'}).length;
        if(currentSrHires<maxSr){
          hiringQueue.push({type:'senior',monthsLeft:hireMo,hirerId:h.id,specIds:[d.archId]});
          break;
        }
      }
    });

    // Junior hiring: if delivery days needed > available
    var aty=activeEngs.filter(function(e){return e.endMonth>ys&&e.startMonth<ye});
    var jDN=0;aty.forEach(function(e){jDN+=Math.max(0,(e.oxoTeam||2)-1)*(Math.min(e.endMonth,ye)-Math.max(e.startMonth,ys))*15});
    var jrGap=jDN-nJ*workD;
    if(jrGap>0){
      var jrNeeded=Math.ceil(jrGap/workD);
      var jrHirers=people.filter(function(p){return p.role==='Director'||p.role==='Senior'});
      var jrQueued=0;
      for(var i=0;i<jrHirers.length&&jrQueued<jrNeeded;i++){
        var h=jrHirers[i];
        var maxJr=h.role==='Director'?3:1;
        var currentJrHires=hiringQueue.filter(function(q){return q.hirerId===h.id&&q.type==='junior'}).length;
        var canHire=maxJr-currentJrHires;
        for(var j=0;j<canHire&&jrQueued<jrNeeded;j++){
          hiringQueue.push({type:'junior',monthsLeft:hireMo,hirerId:h.id});
          jrQueued++;
        }
      }
    }

    var jU=nJ*workD>0?jDN/(nJ*workD):0;

    // Admin scaling
    var totalPeople=nF+people.length+nJ;
    var neededOps=Math.ceil(totalPeople/adminR);if(neededOps>nO)nO=neededOps;
    var hc=nF+people.length+nJ+nO;

    // Tooling trigger: price <= benchmark mid AND 2+ deals
    var engCnt={};staffed.concat(activeEngs).forEach(function(e){engCnt[e.archId]=(engCnt[e.archId]||0)+1});
    archs.forEach(function(a){
      if(a.tooling_cost>0&&!toolingDone[a.id]&&(engCnt[a.id]||0)>=2){
        var mid=((a.benchmark_low||0)+(a.benchmark_high||0))/2;
        var pr=pPrice(a);if(mid<=0||pr.rev<=mid){toolingDone[a.id]=true;toolingSpend+=a.tooling_cost}
      }
    });

    // === FINANCIALS ===
    var nSr=people.filter(function(p){return p.role==='Senior'}).length;
    var nDir=people.filter(function(p){return p.role==='Director'}).length;
    var dirSal=S.director_salary||9000;
    var mSal=nF*(S.founder_salary||7000)+nSr*(S.senior_salary||7000)+nDir*dirSal+nJ*(S.junior_salary||5000)+nO*(S.ops_salary||3500);
    var aS=mSal*12,aO=(hc*ppOH+fixOH)*12;
    var tR=0,tG=0,tV=0,tD=0;
    staffed.forEach(function(d){tR+=d.revenue;tG+=d.guar;tV+=d.vari;tD+=d.direct});

    // Bonuses: separate for seniors and directors
    var bon=0;
    var sbm=(S.senior_bonus_meet||5)/100,sbe=(S.senior_bonus_exceed||10)/100,sbt=(S.senior_bonus_exceed_threshold||150)/100;
    var dbm=(S.director_bonus_meet||7)/100,dbe=(S.director_bonus_exceed||12)/100;
    people.forEach(function(p){
      var tgt=p.role==='Director'?dTarget:sTarget;
      var pctT=tgt>0?p.sold/tgt:0;
      if(p.role==='Director'){if(pctT>=sbt)bon+=p.sold*dbe;else if(pctT>=.95)bon+=p.sold*dbm}
      else if(p.role==='Senior'){if(pctT>=sbt)bon+=p.sold*sbe;else if(pctT>=.95)bon+=p.sold*sbm}
    });
    var jb=(S.junior_billability||80)/100;
    var jrMetGoal=jU>=jb*.95;
    if(jU>=(S.junior_exceed_threshold||120)/10000)bon+=nJ*(S.junior_salary||5000)*12*((S.junior_bonus_exceed||20)/100);
    else if(jrMetGoal)bon+=nJ*(S.junior_salary||5000)*12*((S.junior_bonus_meet||10)/100);
    // Track junior performance for promotion
    if(jrMetGoal)juniorPerf.yearsMetTarget++;else juniorPerf.yearsMetTarget=0;
    var preFC=aS+aO+tD+bon+toolingSpend,netPre=tR-preFC;
    var fb=netPre>0?netPre*(S.founder_profit_share||5)/100*nF:0;bon+=fb;
    var tot=aS+aO+tD+bon+toolingSpend,net=tR-tot,margin=tR>0?net/tR*100:0;cumCash+=net;

    // === Track target achievement for promotion ===
    people.forEach(function(p){
      if(p.role==='Senior'){
        var pctT=sTarget>0?p.sold/sTarget:0;
        if(pctT>=.95)p.yearsMetTarget++;else p.yearsMetTarget=0;
      }
    });

    // === Service lines ===
    var svl={};staffed.forEach(function(d){
      if(!svl[d.archId])svl[d.archId]={name:d.archName,tshirt:d.tshirt,count:0,rev:0,guar:0,dc:0,founders:{},seniorIds:{},oxoTeam:d.oxoTeam||2,dur:d.durationMonths||6};
      var v=svl[d.archId];v.count++;v.rev+=d.revenue;v.guar+=d.guar;v.dc+=d.direct;
      if(d.soldBy[0]==='F')v.founders[d.soldBy]=1;v.seniorIds[d.seniorId]=1;
    });
    var sLines=[];
    Object.keys(svl).forEach(function(k){var v=svl[k];v.staff=(S.senior_salary||7000)*v.dur*v.count+Math.max(0,v.oxoTeam-1)*(S.junior_salary||5000)*v.dur*v.count;v.profit=v.rev-v.dc-v.staff;v.margin=v.rev>0?v.profit/v.rev*100:0;v.seniorCount=Object.keys(v.seniorIds).length;v.founderList=Object.keys(v.founders).join(',');sLines.push(v)});
    sLines.sort(function(a,b){return b.rev-a.rev});

    var fSum=founders.map(function(f){return{id:f.id,sold:f.sold,deals:f.deals,target:fTarget,pct:fTarget>0?f.sold/fTarget:0,hiring:hiringQueue.filter(function(h){return h.hirerId===f.id}).length}});
    var avgLoad=people.length>0?people.reduce(function(s,x){return s+x.load},0)/people.length:0;

    years.push({
      y:y+1,eng:staffed.length,queued:unstaffedThisYear.length,activeCount:aty.length,
      rev:tR,guar:tG,vari:tV,dc:tD,sal:aS,oh:aO,bonus:bon,tooling:toolingSpend,
      total:tot,net:net,margin:margin,cum:cumCash,
      hc:hc,founders:nF,seniors:nSr,directors:nDir,juniors:nJ,ops:nO,
      hiredSr:hiredSrThisYear,hiredJr:hiredJrThisYear,promoted:promotedThisYear,
      pendingHires:hiringQueue.length,
      jUtil:jU,sLines:sLines,fSum:fSum,avgSrLoad:avgLoad,
      rph:totalPeople>0?tR/totalPeople:0,mkt:mkt
    });
  }
  var hc0=(S.founders||0)+(S.senior_consultants||0)+(S.junior_consultants||0)+(S.operations||0);
  var m0=(S.founders||0)*(S.founder_salary||0)+(S.senior_consultants||0)*(S.senior_salary||0)+(S.junior_consultants||0)*(S.junior_salary||0)+(S.operations||0)*(S.ops_salary||0)+hc0*ppOH+fixOH;
  return{years:years,monthly:m0,runway:m0>0?Math.floor((S.initial_capital||0)/m0):99};
}

function eur(v){if(v==null||isNaN(v))return'\u20AC0';var a=Math.abs(v),s=v<0?'\u2212':'';return a>=1e6?s+'\u20AC'+(a/1e6).toFixed(1)+'M':a>=1e3?s+'\u20AC'+(a/1e3).toFixed(0)+'K':s+'\u20AC'+Math.round(a)}
function pct(v){return(v||0).toFixed(0)+'%'}

function render(){
  var sy=window.scrollY,si=sim(),Y=si.years,yN=Y[NYRS-1]||{};var h='';
  h+='<div class="hero"><div class="brand"><div><div class="logo">Ox<em>O</em></div><div class="bsub">Business Model Simulator \u00B7 10 Years</div></div><div style="text-align:right"><div style="font-size:11px;color:var(--tx3)">Seed <input type="number" value="'+(S.sim_seed||42)+'" style="width:50px;background:var(--sf2);border:1px solid var(--bd2);border-radius:4px;color:var(--tx);padding:3px 5px;font-size:11px" onchange="savS(\'sim_seed\',this.value);render()"> <span style="cursor:pointer;color:var(--tc);font-size:16px" onclick="savS(\'sim_seed\',Math.floor(Math.random()*9999));render()">\uD83C\uDFB2</span></div></div></div></div>';
  h+='<div class="scbar"><span class="sclbl">Mode</span><div class="scs">';SCS.forEach(function(s,i){h+='<div class="sc '+(scenario===i?'a':'')+'" onclick="setSc('+i+')">'+s.name+'</div>'});h+='</div></div>';
  var tt=talentTier();
  h+='<div class="kpi-strip">';
  h+='<div class="kpi"><div class="kl">Y'+NYRS+' Revenue</div><div class="kv">'+eur(yN.rev)+'</div><div class="ks">'+(yN.eng||0)+' deals</div></div>';
  h+='<div class="kpi"><div class="kl">Y'+NYRS+' Profit</div><div class="kv '+((yN.net||0)>=0?'green':'red')+'">'+eur(yN.net)+'</div><div class="ks">'+pct(yN.margin)+'</div></div>';
  h+='<div class="kpi"><div class="kl">Y'+NYRS+' Team</div><div class="kv blue">'+(yN.hc||0)+'</div><div class="ks">'+(yN.founders||0)+'F '+(yN.directors||0)+'D '+(yN.seniors||0)+'S '+(yN.juniors||0)+'J</div></div>';
  h+='<div class="kpi"><div class="kl">'+NYRS+'yr Cash</div><div class="kv '+((yN.cum||0)>=0?'green':'red')+'">'+eur(yN.cum)+'</div><div class="ks">from '+eur(S.initial_capital)+'</div></div>';
  h+='<div class="kpi"><div class="kl">Directors</div><div class="kv purple">'+(yN.directors||0)+'</div><div class="ks">promoted seniors</div></div>';
  h+='<div class="kpi"><div class="kl">Talent</div><div class="kv" style="color:'+tt.color+'">'+tt.name+'</div><div class="ks">'+eur((S.senior_salary||7000)*12*1.05)+'/yr</div></div>';
  h+='</div>';

  // Chart
  h+='<div class="sec"><div class="shd"><span class="sn">01</span><span class="stt">'+NYRS+'-Year Trajectory</span><span class="sline"></span></div><div class="cc">'+heroChart(Y)+'</div></div>';

  // Year boards
  h+='<div class="sec"><div class="shd"><span class="sn">02</span><span class="stt">Year-by-Year</span><span class="sline"></span></div>';
  Y.forEach(function(yr,i){
    var teamStr=yr.founders+'F';if(yr.directors)teamStr+=' '+yr.directors+'D';teamStr+=' '+yr.seniors+'S '+yr.juniors+'J';
    var hireStr='';if(yr.hiredSr||yr.hiredJr)hireStr=' \u00B7 <span style="color:var(--tc)">+'+yr.hiredSr+'S +'+yr.hiredJr+'J</span>';
    if(yr.promoted)hireStr+=' <span style="color:var(--purple)">'+yr.promoted+' \u2192 Dir</span>';
    if(yr.queued)hireStr+=' <span style="color:var(--gd2)">'+yr.queued+' queued</span>';
    h+='<div class="yboard"><div class="yboard-head" onclick="toggleYear('+i+')"><div><span class="yboard-yr">Y'+yr.y+'</span>';
    h+='<span class="yboard-sum" style="margin-left:12px">'+yr.eng+' deals \u00B7 '+eur(yr.rev)+' \u00B7 <span style="color:'+(yr.net>=0?'var(--sg2)':'var(--dn)')+'">'+eur(yr.net)+'</span> \u00B7 '+teamStr+hireStr+'</span></div>';
    h+='<span style="font-size:9px;color:var(--tx3)">'+(openYears[i]?'\u25BE':'\u25B8')+'</span></div>';
    h+='<div class="yboard-body '+(openYears[i]?'open':'')+'">';
    h+='<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">';
    yr.fSum.forEach(function(f,fi){if(fi)h+=' \u00B7 ';h+='<span style="color:var(--tc);font-weight:500">'+f.id+'</span> '+eur(f.sold)+'/'+eur(f.target)+' ('+f.deals+'d'+(f.hiring?', hiring '+f.hiring:'')+')'});
    h+='</div>';
    if(yr.sLines.length>0){
      h+='<table class="yt"><thead><tr><th>Service</th><th></th><th style="text-align:right">#</th><th style="text-align:right">Fndrs</th><th style="text-align:right">Leaders</th><th style="text-align:right">Revenue</th><th style="text-align:right">Direct</th><th style="text-align:right">Staff</th><th style="text-align:right">Profit</th><th style="text-align:right">Margin</th></tr></thead><tbody>';
      yr.sLines.forEach(function(sv){h+='<tr><td>'+sv.name+'</td><td><span class="tshirt '+sv.tshirt+'">'+sv.tshirt+'</span></td><td class="n">'+sv.count+'</td><td class="n">'+(sv.founderList||'\u2014')+'</td><td class="n">'+sv.seniorCount+'</td><td class="n p">'+eur(sv.rev)+'</td><td class="n">'+eur(-sv.dc)+'</td><td class="n">'+eur(-sv.staff)+'</td><td class="n '+(sv.profit>=0?'p':'ng')+'">'+eur(sv.profit)+'</td><td class="n '+(sv.margin>0?'p':'ng')+'">'+pct(sv.margin)+'</td></tr>'});
      h+='</tbody></table>';
    }else h+='<div style="color:var(--tx3);font-size:11px">No deals.</div>';
    h+='<div style="display:flex;gap:12px;margin-top:6px;padding:6px 8px;background:var(--sf2);border-radius:8px;font-size:9px;color:var(--tx3);flex-wrap:wrap">';
    h+='<span>Sal '+eur(yr.sal)+'</span><span>OH '+eur(yr.oh)+'</span><span>DC '+eur(yr.dc)+'</span><span>Bonus '+eur(yr.bonus)+'</span>';
    if(yr.tooling>0)h+='<span style="color:var(--gd2)">Tool '+eur(yr.tooling)+'</span>';
    h+='<span style="color:'+(yr.net>=0?'var(--sg2)':'var(--dn)')+'">Net '+eur(yr.net)+' ('+pct(yr.margin)+')</span>';
    h+='<span>Jr '+pct(yr.jUtil*100)+'</span><span>Load '+pct(yr.avgSrLoad*100)+'</span>';
    if(yr.pendingHires)h+='<span style="color:var(--gd2)">'+yr.pendingHires+' hiring</span>';
    h+='</div></div></div>';
  });
  h+='</div>';

  // P&L
  h+='<div class="sec"><div class="shd"><span class="sn">03</span><span class="stt">Consolidated P&L</span><span class="sline"></span></div><div class="cc"><div class="pl-wrap"><table class="yt"><thead><tr><th></th>';
  YRS.forEach(function(y){h+='<th class="yr">'+y+'</th>'});h+='</tr></thead><tbody>';
  function pr(l,fn,cs){h+='<tr><td'+(cs?' style="'+cs+'"':'')+'>'+l+'</td>';Y.forEach(function(y){var v=fn(y);h+='<td class="n'+(v.c?' '+v.c:'')+'"'+(v.s?' style="'+v.s+'"':'')+'>'+v.t+'</td>'});h+='</tr>'}
  pr('Deals',function(y){return{t:y.eng+(y.queued?'+'+y.queued+'q':'')}});
  pr('Revenue',function(y){return{t:eur(y.rev),s:'color:var(--sg2)'}});
  pr('Guaranteed',function(y){return{t:eur(y.guar),s:'color:var(--tx3)'}},'padding-left:12px;color:var(--tx3)');
  h+='<tr class="sp"><td></td>';YRS.forEach(function(){h+='<td></td>'});h+='</tr>';
  pr('Direct',function(y){return{t:eur(-y.dc)}});pr('Salaries',function(y){return{t:eur(-y.sal)}});pr('Overhead',function(y){return{t:eur(-y.oh)}});pr('Bonuses',function(y){return{t:eur(-y.bonus),s:'color:var(--gd2)'}});pr('Tooling',function(y){return{t:y.tooling?eur(-y.tooling):'\u2014'}});
  h+='<tr class="tot"><td>Net</td>';Y.forEach(function(y){h+='<td class="n '+(y.net>=0?'p':'ng')+'">'+eur(y.net)+'</td>'});h+='</tr>';
  pr('Margin',function(y){return{t:pct(y.margin),c:y.margin>10?'p':'ng'}});pr('Cash',function(y){return{t:eur(y.cum),c:y.cum>=0?'p':'ng'}});
  h+='<tr class="sp"><td></td>';YRS.forEach(function(){h+='<td></td>'});h+='</tr>';
  pr('Team',function(y){var s=y.founders+'F';if(y.directors)s+=' '+y.directors+'D';s+=' '+y.seniors+'S '+y.juniors+'J';return{t:s}});
  pr('Hired',function(y){return{t:y.hiredSr||y.hiredJr?'+'+y.hiredSr+'S+'+y.hiredJr+'J':'\u2014',s:y.hiredSr||y.hiredJr?'color:var(--tc)':''}});
  pr('Directors',function(y){return{t:y.directors||'\u2014',s:y.directors?'color:var(--purple)':''}});
  h+='</tbody></table></div></div></div>';

  // Downside
  h+='<div class="sec"><div class="shd"><span class="sn">04</span><span class="stt">Downside</span><span class="sline"></span></div><div class="cc"><div class="pl-wrap"><table class="yt"><thead><tr><th></th>';YRS.forEach(function(y){h+='<th class="yr">'+y+'</th>'});h+='</tr></thead><tbody>';
  pr('Guaranteed',function(y){return{t:eur(y.guar)}});pr('Net',function(y){var n=y.guar-y.total;return{t:eur(n),c:n>=0?'p':'ng'}});h+='</tbody></table></div></div></div>';

  // Panels
  h+='<div class="ptgl '+(panels.arch?'open':'')+'" onclick="tp(\'arch\')"><div><div class="pt-t">Engagement Types</div><div class="pt-s">'+archs.length+' types</div></div><div class="pt-a">\u25B6</div></div><div class="pbdy '+(panels.arch?'open':'')+'">'+rArchs()+'</div>';
  h+='<div class="ptgl '+(panels.costs?'open':'')+'" onclick="tp(\'costs\')"><div><div class="pt-t">Costs, Sales & Bonuses</div><div class="pt-s">'+eur(si.monthly)+'/mo \u00B7 '+si.runway+'mo runway</div></div><div class="pt-a">\u25B6</div></div><div class="pbdy '+(panels.costs?'open':'')+'">'+rCosts()+'</div>';

  document.getElementById('app').innerHTML=h;
  document.querySelectorAll('input[type=range]').forEach(function(el){el.addEventListener('input',function(e){var k=e.target.dataset.key,v=parseFloat(e.target.value);if(e.target.dataset.arch){var a=archs.find(function(x){return x.id==e.target.dataset.arch});if(a){a[k]=v;savA(a)}}else savS(k,v);render()})});
  window.scrollTo(0,sy);
}

function heroChart(Y){
  var maxV=Math.max.apply(null,Y.map(function(y){return Math.max(y.rev,y.total)}).concat([1]));
  var W=1200,H=220,pad=50,cW=W-pad*2,cH=H-40,gap=cW/NYRS,bw=gap*.3;
  var s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:220px" preserveAspectRatio="xMidYMid meet">';
  for(var i=0;i<=4;i++){var gy=18+cH*(1-i/4);s+='<line x1="'+pad+'" y1="'+gy+'" x2="'+(W-pad)+'" y2="'+gy+'" stroke="var(--bd2)" stroke-width=".5"/><text x="'+(pad-4)+'" y="'+(gy+3)+'" text-anchor="end" font-family="JetBrains Mono" font-size="7" fill="var(--tx3)">'+eur(maxV*i/4)+'</text>'}
  Y.forEach(function(y,i){
    var cx=pad+gap*i+gap/2,rh=y.rev/maxV*cH,ch=y.total/maxV*cH;
    s+='<rect x="'+(cx-bw)+'" y="'+(18+cH-rh)+'" width="'+bw+'" height="'+rh+'" fill="var(--tc)" rx="3" opacity=".7"/>';
    s+='<rect x="'+(cx+2)+'" y="'+(18+cH-ch)+'" width="'+(bw*.5)+'" height="'+ch+'" fill="var(--dn)" rx="2" opacity=".2"/>';
    if(i%2===0||NYRS<=5)s+='<text x="'+(cx-bw/2)+'" y="'+(11+cH-rh)+'" text-anchor="middle" font-family="Inter" font-size="8" font-weight="500" fill="var(--tc)">'+eur(y.rev)+'</text>';
    s+='<text x="'+cx+'" y="'+(H-3)+'" text-anchor="middle" font-family="Inter" font-size="8" fill="var(--tx3)">Y'+(i+1)+'</text>';
  });
  var minP=Math.min.apply(null,[0].concat(Y.map(function(y){return y.net}))),maxP=Math.max.apply(null,[1].concat(Y.map(function(y){return y.net}))),pR=maxP-minP||1;
  var pts=Y.map(function(y,i){return{x:pad+gap*i+gap/2,y:18+cH-((y.net-minP)/pR*cH*.35+cH*.08),v:y.net}});
  s+='<polyline points="'+pts.map(function(p){return p.x+','+p.y}).join(' ')+'" fill="none" stroke="var(--tx)" stroke-width="1.5" stroke-dasharray="4,3" opacity=".3"/>';
  pts.forEach(function(p){s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="'+(p.v>=0?'var(--sg)':'var(--dn)')+'" stroke="var(--sf)" stroke-width="2"/>'});
  return s+'</svg>';
}

function rArchs(){var sel=selArch?archs.find(function(a){return a.id===selArch}):null;var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="note" style="margin:0">\u2605 = founders sell. Price vs benchmark + talent tier affect win rate. \uD83D\uDEE0 = tooling.</div><button class="btn pr" onclick="newA()">+ Add</button></div><div class="g2"><div>';
archs.forEach(function(a){var ec=engEcon(a),pos=pricePos(a),inBand=priceInTalentBand(a);var pl=pos<-.2?'\u2193':pos>.2?'\u2191':'\u2248';var pc=pos<-.2?'var(--sg2)':pos>.2?'var(--dn)':'var(--tx3)';h+='<div class="arch '+(selArch===a.id?'sel':'')+'" onclick="selA('+a.id+')"><div style="display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:6px"><span class="star '+(a.founder_focus?'on':'')+'" onclick="event.stopPropagation();toggleStar('+a.id+')">'+(a.founder_focus?'\u2605':'\u2606')+'</span><span class="arch-nm">'+a.name+'</span></div><span class="tshirt '+(a.tshirt||'M')+'">'+(a.tshirt||'M')+'</span></div><div class="arch-meta"><span class="badge">'+ec.label+'</span><span>'+(a.project_length_months||6)+'mo</span><span>'+eur(ec.rev)+'</span><span style="color:'+(ec.margin>20?'var(--sg2)':ec.margin>0?'var(--tx2)':'var(--dn)')+'">'+pct(ec.margin)+'</span><span style="color:'+pc+'">'+pl+'mkt</span>'+(!inBand?'<span style="color:var(--dn)">\u26A0</span>':'')+(a.tooling_cost>0?'<span>\uD83D\uDEE0</span>':'')+'</div></div>'});
h+='</div><div>';if(sel)h+=rArchDet(sel);h+='</div></div>';return h}

function rArchDet(a){var ec=engEcon(a),isBU=a.pricing_model==='base_plus_upside',pos=pricePos(a),wm=priceWinMult(a),inBand=priceInTalentBand(a);var lo=a.benchmark_low||0,hi=a.benchmark_high||0,dotPos=lo<hi?Math.max(0,Math.min(100,(ec.rev-lo)/(hi-lo)*100)):50,dotCol=pos<-.2?'var(--sg)':pos>.2?'var(--dn)':'var(--tc)';var tb=talentPriceBand();
var h='<div class="card" style="position:sticky;top:8px;max-height:calc(100vh-32px);overflow-y:auto"><div class="card-l">Configure</div>';
h+='<div class="g2" style="gap:6px"><div class="field"><label>Name</label><input value="'+(a.name||'')+'" onchange="uf('+a.id+',\'name\',this.value)"></div><div class="field"><label>T-Shirt</label><select onchange="uf('+a.id+',\'tshirt\',this.value)">'+['S','M','L'].map(function(s){return'<option'+(a.tshirt===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div></div>';
h+=as(a,'project_length_months','Duration',a.project_length_months||6,1,24,1,' mo')+as(a,'oxo_team_size','OxO Team (1 leader + juniors)',a.oxo_team_size||2,1,6,1,'')+as(a,'client_team_size','Client Team',a.client_team_size||10,3,40,1,'');
h+='<div class="divider"></div><div class="card-l">Pricing</div><div class="ptog"><div class="pto '+(isBU?'a':'')+'" onclick="pm('+a.id+',\'base_plus_upside\')"><div class="pto-t">B+U</div><div class="pto-d">Fee+share</div></div><div class="pto '+(!isBU?'a':'')+'" onclick="pm('+a.id+',\'outcome_fixed\')"><div class="pto-t">Fixed</div><div class="pto-d">% upside</div></div></div>';
h+=as(a,'estimated_client_upside','Client Upside',a.estimated_client_upside||500000,50000,10000000,50000,'\u20AC');
if(isBU)h+=as(a,'base_fee','Base Fee',a.base_fee||40000,5000,500000,5000,'\u20AC')+as(a,'gain_share_pct','Gain %',a.gain_share_pct||8,1,25,1,'%')+as(a,'gain_share_probability','Probability',a.gain_share_probability||65,10,95,5,'%');else h+=as(a,'upside_pricing_pct','Price %',a.upside_pricing_pct||15,5,40,1,'%');
h+='<div class="divider"></div><div class="card-l">Market Position</div>'+as(a,'benchmark_low','Low',lo,5000,1000000,5000,'\u20AC')+as(a,'benchmark_high','High',hi,10000,2000000,10000,'\u20AC');
h+='<div class="mkt-bar"><div class="mkt-dot" style="left:'+dotPos+'%;background:'+dotCol+'"></div></div><div class="mkt-labels"><span>'+eur(lo)+'</span><span>'+eur(ec.rev)+'</span><span>'+eur(hi)+'</span></div>';
h+='<div class="note">Win rate: <strong style="color:'+dotCol+'">'+wm.toFixed(2)+'\u00D7</strong></div>';
var mid=((lo+hi)/2);if(!inBand){var isOver=ec.rev>tb.high*mid;h+='<div class="talent-bar" style="border:1px solid '+(isOver?'var(--dn)':'var(--gd)')+';background:'+(isOver?'#fff5f5':'#fffbe6')+'">'+(isOver?'\u26A0 Price '+eur(ec.rev)+' exceeds what <span class="tier">'+tb.tier.name+'</span> talent can credibly deliver (ceiling '+eur(tb.high*mid)+'). Clients will doubt quality. <strong>Win rate penalized.</strong> Raise salaries to justify this price.':'\u2139 Price '+eur(ec.rev)+' is below <span class="tier">'+tb.tier.name+'</span> floor ('+eur(tb.low*mid)+'). Competitive but may leave margin on the table.')+'</div>'}
else h+='<div class="talent-bar">\u2713 <span class="tier" style="color:'+tb.tier.color+'">'+tb.tier.name+'</span> \u2014 price and talent aligned ('+eur(tb.low*mid)+'\u2013'+eur(tb.high*mid)+')</div>';
h+='<div class="divider"></div><div class="card-l">Per-Deal Economics</div><div class="econ"><div class="econ-item"><div class="econ-label">Revenue</div><div class="econ-val" style="color:var(--sg2)">'+eur(ec.rev)+'</div></div><div class="econ-item"><div class="econ-label">Direct</div><div class="econ-val">'+eur(ec.direct)+'</div></div><div class="econ-item"><div class="econ-label">Staff</div><div class="econ-val">'+eur(ec.staff)+'</div><div class="econ-sub">1sr+'+Math.max(0,(a.oxo_team_size||2)-1)+'jr</div></div><div class="econ-item"><div class="econ-label">Margin</div><div class="econ-val '+(ec.margin>20?'green':ec.margin>0?'gold':'red')+'">'+pct(ec.margin)+'</div><div class="econ-sub">'+eur(ec.profit)+'</div></div></div>';
h+='<div class="divider"></div><div class="card-l">Tooling</div><div class="note" style="margin:0 0 6px">Triggers when price \u2264 market mid + 2 deals. Reduces costs, boosts win rate.</div>'+as(a,'tooling_cost','Investment',a.tooling_cost||0,0,300000,5000,'\u20AC')+as(a,'tooling_delivery_pct','Cost Reduction',a.tooling_delivery_pct||0,0,50,5,'%')+as(a,'tooling_win_pct','Win Rate Boost',a.tooling_win_pct||0,0,30,5,'%');
h+='<div style="margin-top:8px"><button class="btn dn" onclick="delA('+a.id+')">Delete</button></div></div>';return h}

function rCosts(){var tt=talentTier();var h='<div class="g2"><div><div class="card-l">Team</div>'+gs('founders','Founders',S.founders,1,5,1,'')+gs('starting_directors','Starting Directors',S.starting_directors||0,0,3,1,'')+gs('senior_consultants','Starting Seniors',S.senior_consultants,0,8,1,'')+gs('junior_consultants','Starting Juniors',S.junior_consultants,0,8,1,'')+gs('operations','Ops',S.operations,0,4,1,'')+'<div class="divider"></div>'+gs('founder_salary','Founder Salary',S.founder_salary,4000,20000,500,'\u20AC')+gs('director_salary','Director Salary',S.director_salary||9000,5000,18000,500,'\u20AC')+gs('senior_salary','Senior Salary',S.senior_salary,4000,15000,500,'\u20AC')+gs('junior_salary','Junior Salary',S.junior_salary,2500,8000,500,'\u20AC')+gs('ops_salary','Ops Salary',S.ops_salary,2000,5000,250,'\u20AC')+'<div class="talent-bar">Tier: <span class="tier" style="color:'+tt.color+'">'+tt.name+'</span> \u2014 Blended team comp '+eur(((Math.max((S.senior_salary||7000),(S.director_salary||9000))*12*1.05)+((S.junior_salary||5000)*12*1.1))/2)+'/yr. Price above this tier\u2019s ceiling gets win rate penalty.</div><div class="divider"></div><div class="card-l">Overhead</div>'+gs('office_pp','Office/pp',S.office_pp,200,1200,50,'\u20AC')+gs('tech_pp','Tech/pp',S.tech_pp,100,800,50,'\u20AC')+gs('travel_pp','Travel/pp',S.travel_pp,200,1500,50,'\u20AC')+gs('insurance','Insurance',S.insurance,100,2000,100,'\u20AC')+gs('initial_capital','Capital',S.initial_capital,50000,1500000,25000,'\u20AC')+gs('working_days','Days/Yr',S.working_days||220,200,250,5,'d')+gs('founder_mgmt_pct','Founder Mgmt%',S.founder_mgmt_pct||30,10,50,5,'%')+gs('founder_checkin_days','Check-in/eng/mo',S.founder_checkin_days||2,1,5,1,'d')+gs('hiring_months','Hiring Time',S.hiring_months||3,1,6,1,' mo')+gs('hiring_bandwidth','Hiring BW Cost',S.hiring_bandwidth||25,10,50,5,'%')+'</div>';
h+='<div><div class="card-l">Sales</div>'+gs('founder_sales_target','Founder Target',S.founder_sales_target,500000,5000000,100000,'\u20AC')+gs('senior_sales_target','Senior Target',S.senior_sales_target,300000,3000000,100000,'\u20AC')+gs('director_sales_target','Director Target',S.director_sales_target||1500000,500000,4000000,100000,'\u20AC')+gs('senior_specializations','Senior Specs',S.senior_specializations,1,3,1,' type')+gs('bd_days_new','BD/New',S.bd_days_new,5,25,1,'d')+gs('bd_days_repeat','BD/Repeat',S.bd_days_repeat,1,10,1,'d')+gs('bd_days_referral','BD/Referral',S.bd_days_referral,2,15,1,'d')+gs('win_rate_new','Win% New',S.win_rate_new,10,60,5,'%')+gs('win_rate_repeat','Win% Repeat',S.win_rate_repeat,40,90,5,'%')+gs('win_rate_referral','Win% Referral',S.win_rate_referral,20,70,5,'%')+gs('repeat_rate','Repeat%',S.repeat_rate,10,70,5,'%')+gs('referral_rate','Referral%',S.referral_rate,5,40,5,'%')+gs('admin_ratio','Admin 1:N',S.admin_ratio,3,12,1,':1')+'<div class="divider"></div><div class="card-l">Marketing</div>'+gs('marketing_conservative','Conservative',S.marketing_conservative||3000,1000,15000,500,'\u20AC/mo')+gs('marketing_base','Base',S.marketing_base||5000,1000,20000,500,'\u20AC/mo')+gs('marketing_aggressive','Aggressive',S.marketing_aggressive||8000,2000,30000,500,'\u20AC/mo')+'<div class="divider"></div><div class="card-l">Bonuses</div>'+gs('senior_bonus_meet','Sr (meet)',S.senior_bonus_meet,0,15,1,'%')+gs('senior_bonus_exceed','Sr (150%+)',S.senior_bonus_exceed,0,20,1,'%')+gs('director_bonus_meet','Dir (meet)',S.director_bonus_meet||7,0,15,1,'%')+gs('director_bonus_exceed','Dir (150%+)',S.director_bonus_exceed||12,0,20,1,'%')+gs('junior_bonus_meet','Jr (meet)',S.junior_bonus_meet,0,25,5,'%')+gs('junior_bonus_exceed','Jr (120%+)',S.junior_bonus_exceed,0,30,5,'%')+gs('founder_profit_share','Founder profit',S.founder_profit_share,0,15,1,'% ea')+gs('senior_hire_salary','Hire Sr',S.senior_hire_salary,4000,15000,500,'\u20AC')+gs('junior_hire_salary','Hire Jr',S.junior_hire_salary,2500,8000,500,'\u20AC')+'</div></div>';return h}

function gs(k,l,v,min,max,step,u){u=u||'';var d=u==='\u20AC'||u.indexOf('\u20AC')===0?'\u20AC'+(v||0).toLocaleString():u==='%'||u.indexOf('%')>=0?(v||0)+u:(v||0)+u;return'<div class="sg"><div class="sl"><span class="snm">'+l+'</span><span class="svl">'+d+'</span></div><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+(v||min)+'" data-key="'+k+'"></div>'}
function as(a,k,l,v,min,max,step,u){u=u||'';var d=u==='\u20AC'||u.indexOf('\u20AC')===0?'\u20AC'+(v||0).toLocaleString():u==='%'?(v||0)+'%':(v||0)+u;return'<div class="sg"><div class="sl"><span class="snm">'+l+'</span><span class="svl">'+d+'</span></div><input type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+(v||min)+'" data-key="'+k+'" data-arch="'+a.id+'"></div>'}
window.setSc=function(i){scenario=i;render()};window.selA=function(id){selArch=id;panels.arch=true;render()};window.toggleStar=function(id){var a=archs.find(function(x){return x.id===id});if(a){a.founder_focus=a.founder_focus?0:1;savA(a);render()}};window.newA=newA;window.delA=delA;window.pm=function(id,m){var a=archs.find(function(x){return x.id===id});if(a){a.pricing_model=m;savA(a);render()}};window.uf=function(id,f,v){var a=archs.find(function(x){return x.id===id});if(a){a[f]=['name','sector','notes','pricing_model','tshirt','description'].indexOf(f)>=0?v:parseFloat(v);savA(a);render()}};window.tp=function(k){panels[k]=!panels[k];render()};window.toggleYear=function(i){openYears[i]=!openYears[i];render()};
load();
