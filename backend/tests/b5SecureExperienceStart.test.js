"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const MockTest = require("../src/models/MockTest");
const MockTestVersion = require("../src/models/MockTestVersion");
const TestAttempt = require("../src/models/TestAttempt");
const TestAttemptDetail = require("../src/models/TestAttemptDetail");
const TestAttemptAdmissionGuard = require("../src/models/TestAttemptAdmissionGuard");
const { startMockTestAttempt } = require("../src/controllers/studentMockTestController");
const { buildAttemptTimingState } = require("../src/utils/attemptTimingPolicy");
const { resolveNewAttemptExperience, validateResumeExperience } = require("../src/utils/experiencePolicy");
const ids={student:"507f1f77bcf86cd799439011",test:"507f1f77bcf86cd799439012",version:"507f1f77bcf86cd799439013",reasoning:"507f1f77bcf86cd799439021",maths:"507f1f77bcf86cd799439022"};
const originals={m:MockTest.findOne,v:MockTestVersion.findOne,af:TestAttempt.findOne,ac:TestAttempt.create,an:TestAttempt.countDocuments,ad:TestAttempt.deleteOne,df:TestAttemptDetail.findOne,dc:TestAttemptDetail.create,guard:TestAttemptAdmissionGuard.updateOne,session:mongoose.startSession};
const dual={policyVersion:1,allowedModes:["exam_simulation","practice"]};
const reply=()=>({statusCode:200,body:null,status(s){this.statusCode=s;return this},json(b){this.body=b;return this}});
const request=(mode,provided)=>({user:{_id:ids.student,tenantId:"pravixoedutech",role:"student"},params:{mockTestId:ids.test},...(provided?{body:{experienceMode:mode}}:{})});
function makeVersion(policy,mode="sectional") {
 const settings={maxAttempts:2,solutionVisibility:"after_submit"};
 if(policy!==undefined) settings.experiencePolicy=policy;
 return {_id:ids.version,accessType:"free",testType:"mock",title:"Practice selection",slug:"practice-selection",examPatternSnapshot:{name:"Exam",examType:"railway",timingMode:mode,timingPolicyVersion:1,totalDurationMinutes:30},settings,sections:[
  {sectionSlug:"reasoning",name:"Reasoning",order:1,durationMinutes:10,questionCount:1,questions:[{_id:ids.reasoning,questionId:ids.reasoning,order:1,questionType:"mcq",questionTextEn:"REASONING_QUESTION",options:[{optionId:"A",textEn:"R"}],marks:1,negativeMarks:0}]},
  {sectionSlug:"maths",name:"Maths",order:2,durationMinutes:20,questionCount:1,questions:[{_id:ids.maths,questionId:ids.maths,order:1,questionType:"mcq",questionTextEn:"MATHS_SECRET",options:[{optionId:"A",textEn:"M"}],marks:1,negativeMarks:0}]}
 ]};
}
// Session-aware, promise-compatible query doubles preserve the production chain shape.
function query(value){
 return {
  session(session){assert.ok(session,"database query must receive the admission session");return Promise.resolve().then(value)},
  sort(){return this}, select(){return this},
  then(ok,bad){return Promise.resolve().then(value).then(ok,bad)}
 };
}
function install(policy,patternMode="sectional"){
 const state={mock:{_id:ids.test,tenantId:"pravixoedutech",accessType:"free",activeVersionId:ids.version,isActive:true,isPublished:true,settings:{experiencePolicy:dual}},version:makeVersion(policy,patternMode),attempt:null,detail:null,createCount:0,saveCount:0,quota:0,duplicate:false};
 MockTest.findOne=()=>query(()=>state.mock);
 MockTestVersion.findOne=()=>query(()=>state.version);
 mongoose.startSession=async()=>({async withTransaction(run){return run()},async endSession(){}});
 TestAttemptAdmissionGuard.updateOne=async(_filter,_update,options)=>{assert.ok(options?.session,"guard write must be transactional");assert.equal(options.upsert,true);};
 TestAttempt.findOne=(filter)=>query(()=>{
   if(filter.status==="in_progress") return state.attempt && state.attempt.status==="in_progress" ? state.attempt:null;
   return state.attempt?{attemptNumber:state.attempt.attemptNumber}:null;
 });
 TestAttempt.countDocuments=(filter)=>query(()=>filter.status==="in_progress"
   ? Number(Boolean(state.attempt && state.attempt.status==="in_progress"))
   : state.quota);
 TestAttempt.create=async (docs,options)=>{assert.ok(Array.isArray(docs));assert.ok(options?.session);const data=docs[0];state.createCount++;if(state.duplicate){const e=new Error("duplicate");e.code=11000;throw e;}state.attempt={_id:"507f1f77bcf86cd799439014",...data,async save(opts){assert.ok(opts?.session);state.saveCount++;return this}};return [state.attempt];};
 TestAttempt.deleteOne=async()=>({deletedCount:1});
 TestAttemptDetail.findOne=()=>query(()=>state.detail);
 TestAttemptDetail.create=async (docs,options)=>{assert.ok(Array.isArray(docs));assert.ok(options?.session);const data=docs[0];state.detail={_id:"507f1f77bcf86cd799439015",...data};return [state.detail]};
 return state;
}
function restore(){MockTest.findOne=originals.m;MockTestVersion.findOne=originals.v;TestAttempt.findOne=originals.af;TestAttempt.create=originals.ac;TestAttempt.countDocuments=originals.an;TestAttempt.deleteOne=originals.ad;TestAttemptDetail.findOne=originals.df;TestAttemptDetail.create=originals.dc;TestAttemptAdmissionGuard.updateOne=originals.guard;mongoose.startSession=originals.session;}
async function start(mode,provided=true){const res=reply();await startMockTestAttempt(request(mode,provided),res);return res}

test("B5-B2-B2 published selection, server timing, immutable resume and quota",async t=>{
 try {
  await t.test("legacy without policy and body remains unchanged",async()=>{const s=install(undefined);const r=await start(null,false);assert.equal(r.statusCode,201);assert.equal(s.createCount,1);assert.equal(r.body.data.attempt.experienceMode,null);assert.equal(r.body.data.attempt.timing.mode,"sectional")});
  await t.test("legacy published version rejects client-selected practice",async()=>{const s=install(undefined);const r=await start("practice");assert.equal(r.statusCode,400);assert.equal(s.createCount,0)});
  await t.test("dual published policy requires explicit mode and rejects invalid values",async()=>{const s=install(dual);for(const [mode,provided] of [[null,false],["unknown",true],[null,true],[[],true],[{},true]]){const r=await start(mode,provided);assert.equal(r.statusCode,400);}assert.equal(s.createCount,0)});
  await t.test("practice receives server-created global timing and all sections",async()=>{const s=install(dual);const r=await start("practice");assert.equal(r.statusCode,201);assert.equal(s.attempt.experienceMode,"practice");assert.equal(s.attempt.timingState.mode,"global");assert.equal(r.body.data.test.contentScope,"all_sections");assert.equal(r.body.data.test.sections[1].questions.length,1);assert.equal(s.version.examPatternSnapshot.timingMode,"sectional")});
  await t.test("simulation remains strict sectional with hidden future content",async()=>{const s=install(dual);const r=await start("exam_simulation");assert.equal(r.statusCode,201);assert.equal(s.attempt.experienceMode,"exam_simulation");assert.equal(r.body.data.attempt.timing.mode,"sectional");assert.equal(r.body.data.test.sections[1].questions.length,0);assert.equal(JSON.stringify(r.body).includes("MATHS_SECRET"),false)});
  await t.test("simulation respects globally timed exam patterns",async()=>{const s=install(dual,"global");const r=await start("exam_simulation");assert.equal(r.statusCode,201);assert.equal(s.attempt.timingState.mode,"global")});
  await t.test("single published mode safely defaults without body",async()=>{const s=install({policyVersion:1,allowedModes:["practice"]});const r=await start(null,false);assert.equal(r.statusCode,201);assert.equal(s.attempt.experienceMode,"practice")});
  await t.test("resume with conflicting mode has no writes; same mode preserves windows",async()=>{const s=install(dual);assert.equal((await start("exam_simulation")).statusCode,201);const originalTiming=s.attempt.timingState;const saved=s.saveCount;const createCount=s.createCount;const denied=await start("practice");assert.equal(denied.statusCode,409);assert.equal(s.saveCount,saved);assert.equal(s.createCount,createCount);const okay=await start("exam_simulation");assert.equal(okay.statusCode,200);assert.equal(okay.body.data.resumed,true);assert.strictEqual(s.attempt.timingState,originalTiming);assert.equal(okay.body.data.attempt.experienceMode,"exam_simulation")});
  await t.test("legacy resume denies supplied experience mode",async()=>{const s=install(undefined);assert.equal((await start(null,false)).statusCode,201);const r=await start("practice");assert.equal(r.statusCode,409);assert.equal(s.createCount,1)});
  await t.test("shared attempt limit blocks further mode-based retake",async()=>{const s=install(dual);s.quota=2;const r=await start("practice");assert.equal(r.statusCode,403);assert.equal(s.createCount,0)});
  await t.test("duplicate attempt number maps to retryable conflict, not 500",async()=>{const s=install(dual);s.duplicate=true;const r=await start("exam_simulation");assert.equal(r.statusCode,409)});
  await t.test("selection uses published policy rather than draft policy",async()=>{const s=install({policyVersion:1,allowedModes:["exam_simulation"]});s.mock.settings.experiencePolicy=dual;const r=await start("practice");assert.equal(r.statusCode,400);assert.equal(s.createCount,0)});
 } finally {restore()}
});

test("B5-B2-B2 pure validation and model compatibility",()=>{
 assert.deepEqual(resolveNewAttemptExperience(undefined,undefined),{valid:true,mode:undefined});
 assert.equal(resolveNewAttemptExperience(undefined,"practice").valid,false);
 assert.equal(resolveNewAttemptExperience(dual,undefined).valid,false);
 assert.equal(resolveNewAttemptExperience(dual,"practice").mode,"practice");
 assert.equal(validateResumeExperience(undefined,"practice").valid,false);
 assert.equal(validateResumeExperience("practice","exam_simulation").valid,false);
 assert.equal(validateResumeExperience("practice",undefined).valid,true);
 assert.equal(TestAttempt.schema.path("experienceMode").options.immutable,true);
 assert.equal(new TestAttempt().experienceMode,undefined);
 const version=makeVersion(dual);
 assert.equal(buildAttemptTimingState({mockTestVersion:version,startedAt:new Date(),experienceMode:"practice"}).mode,"global");
 assert.equal(buildAttemptTimingState({mockTestVersion:version,startedAt:new Date(),experienceMode:"exam_simulation"}).mode,"sectional");
 assert.throws(()=>buildAttemptTimingState({mockTestVersion:makeVersion(undefined),startedAt:new Date(),experienceMode:"practice"}));
});
