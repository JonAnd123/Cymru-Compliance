import pgserver, psycopg2, psycopg2.extras, uuid, sys, warnings
warnings.filterwarnings("ignore")
srv = pgserver.get_server("/tmp/pgtest/data", cleanup_mode="stop")
uri = srv.get_uri()
conn = psycopg2.connect(uri); conn.autocommit = True
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

passed = failed = 0
def check(name, cond):
    global passed, failed
    if cond: passed += 1; print("  PASS", name)
    else: failed += 1; print("  FAIL", name)

def su(sql, args=None):
    cur.execute("reset role"); cur.execute("select set_config('request.jwt.claim.sub','',false)")
    cur.execute(sql, args)
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return []

def as_user(uid, sql, args=None, expect_error=False):
    """run as authenticated user; returns (rows, error)"""
    cur.execute("reset role")
    cur.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uid) if uid else '',))
    cur.execute("set role " + ("authenticated" if uid else "anon"))
    try:
        cur.execute(sql, args)
        try: rows = cur.fetchall()
        except psycopg2.ProgrammingError: rows = []
        return rows, None
    except Exception as e:
        return [], str(e).strip().split("\n")[0]
    finally:
        cur.execute("reset role")

def signup(email, name=None):
    uid = str(uuid.uuid4())
    try:
        cur.execute("insert into auth.users(id,email,raw_user_meta_data) values(%s,%s,%s)", (uid,email,psycopg2.extras.Json({"full_name":name} if name else {})))
        return uid
    except Exception as e:
        return None

print("== Sign-up gating")
check("no invite => signup rejected", signup("rando@x.com") is None)
admin = signup("jonathan.milton.anderson@gmail.com")
check("bootstrap admin invite => profile created", admin and su("select role from profiles where id=%s",(admin,))[0]["role"]=="platform_admin")

# orgs as admin
g = as_user(admin, "insert into groups(name) values('Cardiff Bay Group') returning id")[0][0]["id"]
p1 = as_user(admin, "insert into practices(name,group_id) values('P1',%s) returning id",(g,))[0][0]["id"]
p2 = as_user(admin, "insert into practices(name,group_id) values('P2',%s) returning id",(g,))[0][0]["id"]
p3 = as_user(admin, "insert into practices(name) values('P3 independent') returning id")[0][0]["id"]
def invite(by, email, role, practice=None, group=None):
    return as_user(by, "insert into invites(email,role,practice_id,group_id,full_name) values(%s,%s,%s,%s,%s)", (email,role,practice,group,email.split('@')[0]))
for em,role,pr,gr in [("ga@x.com","group_admin",None,g),("pr1@x.com","principal",p1,None),("pr2@x.com","principal",p2,None),("pr3@x.com","principal",p3,None),("insp@hiw.wales","inspector",None,None)]:
    _,err = invite(admin, em, role, pr, gr); assert err is None, err
ga, pr1, pr2, pr3, insp = [signup(e) for e in ["ga@x.com","pr1@x.com","pr2@x.com","pr3@x.com","insp@hiw.wales"]]
check("principal profile bound to practice", su("select practice_id from profiles where id=%s",(pr1,))[0]["practice_id"]==p1)
check("group admin profile bound to group", su("select group_id from profiles where id=%s",(ga,))[0]["group_id"]==g)

print("== Invites")
_,err = invite(pr1,"staff1@x.com","staff",p1); check("principal can invite staff", err is None)
_,err = invite(pr1,"pm1@x.com","practice_manager",p1); check("principal can invite practice manager", err is None)
_,err = invite(pr1,"evil@x.com","principal",p1); check("principal cannot invite principal", err is not None)
_,err = invite(pr1,"evil2@x.com","staff",p2); check("principal cannot invite into another practice", err is not None)
_,err = invite(pr1,"admin2@x.com","platform_admin"); check("principal cannot invite platform admin", err is not None)
staff1 = signup("staff1@x.com"); pm1 = signup("pm1@x.com")
_,err = invite(pm1,"staff1b@x.com","staff",p1); check("practice manager can invite staff", err is None)
_,err = invite(pm1,"pm2@x.com","practice_manager",p1); check("practice manager cannot invite practice manager", err is not None)
_,err = invite(ga,"newprin@x.com","principal",p2); check("group admin can invite principal in own group", err is None)
_,err = invite(ga,"newprin3@x.com","principal",p3); check("group admin cannot invite principal for independent practice", err is not None)

print("== Evidence")
ev,err = as_user(pr1,"insert into evidence(practice_id,category,title,expiry_date,status) values(%s,'staff_training','DBS J',current_date+90,'verified') returning id",(p1,))
check("principal can add evidence", err is None); ev1 = ev[0]["id"]
_,err = as_user(pr1,"insert into evidence(practice_id,category,title) values(%s,'policies','x')",(p2,)); check("principal cannot add evidence to other practice", err is not None)
rows,_ = as_user(pr2,"select * from evidence"); check("other practice principal sees none", len(rows)==0)
rows,_ = as_user(staff1,"select * from evidence"); check("staff cannot see practice evidence they didn't upload", len(rows)==0)
sev,err = as_user(staff1,"insert into evidence(practice_id,category,title,uploaded_by,staff_member) values(%s,'staff_training','My cert',%s,%s) returning id",(p1,staff1,staff1))
check("staff can upload own pending evidence", err is None); sev = sev[0]["id"]
_,err = as_user(staff1,"insert into evidence(practice_id,category,title,uploaded_by,status) values(%s,'staff_training','Self-verified',%s,'verified')",(p1,staff1)); check("staff cannot insert pre-verified evidence", err is not None)
_,err = as_user(staff1,"update evidence set status='verified' where id=%s",(sev,))
rows = su("select status from evidence where id=%s",(sev,)); check("staff cannot self-verify", rows[0]["status"]=="pending")
rows,_ = as_user(staff1,"select * from evidence"); check("staff sees own evidence", len(rows)==1)
_,err = as_user(pm1,"update evidence set status='verified' where id=%s",(sev,))
rows = su("select status,verified_by from evidence where id=%s",(sev,)); check("practice manager can verify (verified_by set)", rows[0]["status"]=="verified" and str(rows[0]["verified_by"])==pm1)
rows,_ = as_user(ga,"select * from evidence"); check("group admin cannot read evidence rows", len(rows)==0)

print("== Dashboard inputs / group average")
r,err = as_user(pr1,"select practice_inputs(%s) as x",(p1,)); check("principal can get own practice inputs", err is None and len(r[0]["x"]["evidence"])==2)
_,err = as_user(pr1,"select practice_inputs(%s) as x",(p2,)); check("principal cannot get other practice inputs", err is not None)
r,err = as_user(ga,"select practice_inputs(%s) as x",(p2,)); check("group admin can get group practice inputs", err is None)
_,err = as_user(ga,"select practice_inputs(%s) as x",(p3,)); check("group admin cannot get independent practice inputs", err is not None)
r,err = as_user(staff1,"select practice_inputs(%s) as x",(p1,)); check("staff can get own practice (aggregate) inputs", err is None)
aud = su("select count(*) c from audit_log where actor=%s and action='view_dashboard'",(ga,))[0]["c"]; check("group admin dashboard view audited", aud>=1)
as_user(pr1,"insert into compliance_snapshots(practice_id,score) values(%s,80)",(p1,)); as_user(pr2,"insert into compliance_snapshots(practice_id,score) values(%s,60)",(p2,))
r,err = as_user(pr1,"select group_average(%s) as a",(p1,)); check("group average computed (70)", err is None and float(r[0]["a"])==70.0)
r,err = as_user(pr3,"select group_average(%s) as a",(p3,)); check("independent practice has no group average", err is None and r[0]["a"] is None)


print("== Group admin creates practice (INSERT ... RETURNING)")
r,err = as_user(ga,"insert into practices(name,group_id,package) values('P-new',%s,'group') returning id",(g,))
check("group admin can create practice and read it back", err is None and len(r)==1)
if r:
    npid=r[0]["id"]
    _,err = invite(ga,"newp@x.com","principal",npid); check("group admin can invite principal into the new practice", err is None)
    rows,_ = as_user(ga,"select id from practices"); check("new practice visible to group admin", any(x["id"]==npid for x in rows))
    _,err = as_user(ga,"delete from practices where id=%s",(npid,)); check("group admin cannot delete practices", su("select count(*) c from practices where id=%s",(npid,))[0]["c"]==1)

print("== Practices / groups guards")
_,err = as_user(pr1,"update practices set group_id=null where id=%s",(p1,)); check("principal cannot leave group", err is not None)
_,err = as_user(pr1,"update practices set name='P1 renamed' where id=%s",(p1,)); check("principal can rename own practice", err is None)
_,err = as_user(ga,"update practices set group_id=null where id=%s",(p2,)); check("group admin can remove practice from group", err is None)
rows,_ = as_user(ga,"select id from practices"); check("group admin no longer sees the removed practice", len(rows)==2 and all(str(r["id"])!=p2 for r in rows))
as_user(ga,"update practices set group_id=%s where id=%s",(g,p2))  # no longer permitted
check("group admin cannot re-add a removed practice", all(str(r["id"])!=p2 for r in as_user(ga,"select id from practices")[0]))
su("update practices set group_id=%s where id=%s",(g,p2))
rows,_ = as_user(pr2,"select * from groups"); check("principal can see own group name", len(rows)==1)
rows,_ = as_user(pr3,"select * from groups"); check("independent principal sees no groups", len(rows)==0)

print("== Inspector grants")
rows,_ = as_user(insp,"select * from practices"); check("inspector sees nothing without grant", len(rows)==0)
_,err = as_user(pr1,"insert into inspector_grants(practice_id,inspector_email,expires_at) values(%s,'insp@hiw.wales',now()+interval '14 days')",(p1,)); check("principal can grant inspector access", err is None)
rows,_ = as_user(insp,"select id from practices"); check("inspector sees granted practice only", len(rows)==1)
rows,_ = as_user(insp,"select id from evidence"); check("inspector reads evidence of granted practice", len(rows)==2)
_,err = as_user(insp,"insert into evidence(practice_id,category,title) values(%s,'policies','x')",(p1,)); check("inspector cannot write", err is not None)
_,err = as_user(insp,"update evidence set title='hax'"); check("inspector cannot update (no rows)", su("select count(*) c from evidence where title='hax'")[0]["c"]==0)
rows,_ = as_user(insp,"select id from practices where id=%s",(p2,)); check("inspector cannot see other practices", len(rows)==0)
_,err = as_user(staff1,"insert into inspector_grants(practice_id,inspector_email,expires_at) values(%s,'x@y.z',now()+interval '1 day')",(p1,)); check("staff cannot grant inspector access", err is not None)
_,err = as_user(pr1,"update inspector_grants set revoked=true where practice_id=%s",(p1,)); 
rows,_ = as_user(insp,"select id from practices"); check("revoked grant removes access", len(rows)==0)
as_user(pr1,"insert into inspector_grants(practice_id,inspector_email,starts_at,expires_at) values(%s,'insp@hiw.wales',now()-interval '10 days',now()-interval '1 day')",(p1,))
rows,_ = as_user(insp,"select id from practices"); check("expired grant gives no access", len(rows)==0)

print("== Bookings / training / assessments")
_,err = as_user(ga,"insert into bookings(practice_id,kind,seats) values(%s,'pm_training',2)",(p2,)); check("group admin can book for group practice", err is None)
_,err = as_user(ga,"insert into bookings(practice_id,kind) values(%s,'pre_inspection')",(p3,)); check("group admin cannot book for outside practice", err is not None)
_,err = as_user(staff1,"insert into bookings(practice_id,kind) values(%s,'pre_inspection')",(p1,)); check("staff cannot book", err is not None)
rows,_ = as_user(ga,"select * from bookings"); check("group admin sees group bookings", len(rows)==1)
mod = su("select id from training_modules where kind='induction' limit 1")[0]["id"]
_,err = as_user(pr1,"insert into training_assignments(module_id,profile_id,practice_id) values(%s,%s,%s)",(mod,staff1,p1)); check("principal assigns training", err is None)
_,err = as_user(staff1,"update training_assignments set progress=100,status='completed',completed_at=now() where profile_id=%s",(staff1,)); check("staff updates own progress", err is None and su("select status from training_assignments where profile_id=%s",(staff1,))[0]["status"]=="completed")
rows,_ = as_user(staff1,"select * from training_assignments"); check("staff sees only own assignments", len(rows)==1)
a,err = as_user(pr1,"insert into assessments(practice_id) values(%s) returning id",(p1,)); check("principal starts assessment", err is None); aid=a[0]["id"]
_,err = as_user(pr1,"insert into assessment_answers select %s, id, 'yes' from assessment_questions where category='registration'",(aid,)); check("principal saves answers", err is None)
_,err = as_user(pr2,"insert into assessment_answers values(%s,1,'no')",(aid,)); check("other principal cannot write answers", err is not None)
as_user(pr1,"update assessments set status='completed',completed_at=now(),score=90 where id=%s",(aid,))
r,_ = as_user(pr1,"select practice_inputs(%s) as x",(p1,)); check("completed assessment appears in inputs", r[0]["x"]["assessment"] is not None and len(r[0]["x"]["assessment"]["answers"])==4)

print("== Team management RPCs")
_,err = as_user(pr1,"select team_set_active(%s,false)",(staff1,)); check("principal can deactivate staff", err is None)
rows,_ = as_user(staff1,"select * from practices"); rows2,_ = as_user(staff1,"select * from training_assignments"); r3,e3 = as_user(staff1,"select practice_inputs(%s) as x",(p1,)); check("deactivated user loses all data access", len(rows)==0 and len(rows2)==0 and e3 is not None)
_,err = as_user(pr2,"select team_set_active(%s,true)",(staff1,)); check("other principal cannot reactivate", err is not None)
as_user(pr1,"select team_set_active(%s,true)",(staff1,))
_,err = as_user(pr1,"select admin_update_profile(%s,'platform_admin',null,null,true)",(pr1,)); check("principal cannot self-promote", err is not None)
_,err = as_user(admin,"select admin_update_profile(%s,'principal',%s,null,true)",(staff1,p1)); check("platform admin can change roles", err is None)
_,err = as_user(pr1,"update profiles set role='platform_admin' where id=%s",(pr1,)); 
check("no direct profile writes", su("select role from profiles where id=%s",(pr1,))[0]["role"]=="principal")
_,err = as_user(pr1,"select update_my_profile('Dr Sian','cy')"); check("user can update own name/language", su("select language from profiles where id=%s",(pr1,))[0]["language"]=="cy")

print("== Audit / enquiries")
rows,_ = as_user(pr1,"select * from audit_log"); check("principal reads own practice audit only", all(str(r["practice_id"])==p1 for r in rows))
_,err = as_user(pr1,"delete from audit_log"); check("audit log not deletable", su("select count(*) c from audit_log")[0]["c"]>0)
_,err = as_user(None,"insert into enquiries(kind,name,email) values('demo','A','a@b.c')"); check("anon can submit enquiry", err is None)
rows,_ = as_user(None,"select * from enquiries"); check("anon cannot read enquiries", len(rows)==0)
rows,_ = as_user(pr1,"select * from enquiries"); check("principal cannot read enquiries", len(rows)==0)
rows,_ = as_user(admin,"select * from enquiries"); check("admin reads enquiries", len(rows)==1)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
