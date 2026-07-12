#include "fenrua/p521/field_element.hpp"
#include "fenrua/evidence/sha256_digest.hpp"
#include "fenrua/mesh/state_machine.hpp"
#include <boost/multiprecision/cpp_int.hpp>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <random>
#include <span>
#include <string>
#include <vector>
using boost::multiprecision::cpp_int;
using fenrua::p521::FieldElement;

[[noreturn]] void fail(const std::string& s){ std::cerr << "FAIL: " << s << "\n"; std::exit(1); }
cpp_int as_int(const FieldElement::Limbs& a){ cpp_int x=0; for(size_t i=a.size();i-->0;){x<<=64;x+=a[i];} return x; }
FieldElement::Limbs as_limbs(cpp_int x){ FieldElement::Limbs a{}; cpp_int m=(cpp_int(1)<<64)-1; for(auto &v:a){v=(x&m).convert_to<uint64_t>();x>>=64;}return a; }
FieldElement make(cpp_int x){ auto o=FieldElement::from_canonical_limbs(as_limbs(x)); if(!o) fail("make rejected canonical"); return *o; }
cpp_int from_bytes(std::span<const std::byte> b){ cpp_int x=0; for(auto v:b){x<<=8;x+=std::to_integer<unsigned>(v);}return x; }
void check_value(const cpp_int& x,const cpp_int& p){
 auto f=make(x); if(as_int(f.limbs())!=x) fail("limb roundtrip");
 auto b=f.to_bytes_be(); if(from_bytes(b)!=x) fail("serialize integer mismatch");
 auto g=FieldElement::from_bytes_be(b); if(!g || *g!=f) fail("byte roundtrip mismatch");
 if(f.is_zero() != (x==0)) fail("is_zero mismatch");
 cpp_int neg=(p-x)%p; if(as_int(fenrua::p521::negate(f).limbs())!=neg) fail("negate mismatch");
}
int main(){
 const cpp_int p=(cpp_int(1)<<521)-1;
 std::vector<cpp_int> edge={0,1,2,3,(cpp_int(1)<<8)-1,cpp_int(1)<<8,(cpp_int(1)<<64)-1,cpp_int(1)<<64,(cpp_int(1)<<512)-1,cpp_int(1)<<512,(cpp_int(1)<<520),(cpp_int(1)<<521)-2,p-2,p-1};
 for(const auto& x:edge) check_value(x,p);
 for(const auto& x:edge) for(const auto& y:edge){
   auto a=make(x),b=make(y);
   if(as_int(fenrua::p521::add(a,b).limbs()) != (x+y)%p) fail("edge add mismatch");
   cpp_int want=(x-y)%p;if(want<0)want+=p;
   if(as_int(fenrua::p521::subtract(a,b).limbs()) != want) fail("edge sub mismatch");
 }
 FieldElement::Limbs mod{};mod.fill(UINT64_MAX);mod[8]=511;
 if(FieldElement::from_canonical_limbs(mod)) fail("accepted modulus limbs");
 auto over=mod;over[8]=512;if(FieldElement::from_canonical_limbs(over)) fail("accepted >521-bit limbs");
 FieldElement::Bytes modbytes{};cpp_int tmp=p;for(size_t i=66;i-->0;){modbytes[i]=std::byte((tmp&255).convert_to<unsigned>());tmp>>=8;}
 if(FieldElement::from_bytes_be(modbytes)) fail("accepted modulus bytes");
 if(FieldElement::from_bytes_be(std::span<const std::byte>(modbytes).first<65>())) fail("accepted short bytes");

 std::mt19937_64 rng(0x46454e525541ULL);
 for(size_t it=0;it<500000;it++){
   auto randx=[&](){FieldElement::Limbs l{};for(auto &v:l)v=rng();l[8]&=511;cpp_int x=as_int(l);if(x==p)x=0;return x;};
   cpp_int x=randx(), y=randx();auto a=make(x),b=make(y);
   cpp_int got=as_int(fenrua::p521::add(a,b).limbs()),want=(x+y)%p;if(got!=want)fail("random add mismatch at "+std::to_string(it));
   want=(x-y)%p;if(want<0)want+=p;got=as_int(fenrua::p521::subtract(a,b).limbs());if(got!=want)fail("random sub mismatch at "+std::to_string(it));
   got=as_int(fenrua::p521::negate(a).limbs());want=(p-x)%p;if(got!=want)fail("random negate mismatch at "+std::to_string(it));
   if((it%7)==0)check_value(x,p);
 }
 for(size_t it=0;it<200000;it++){
   FieldElement::Bytes b{};for(auto &v:b)v=std::byte(rng()&255);cpp_int x=from_bytes(b);bool expected=x<p;auto f=FieldElement::from_bytes_be(b);if(bool(f)!=expected)fail("random parse accept mismatch");if(f && from_bytes(f->to_bytes_be())!=x)fail("random parse roundtrip");
 }
 using fenrua::evidence::Sha256Digest;
 for(size_t it=0;it<100000;it++){
   Sha256Digest::Bytes b{};for(auto &v:b)v=std::byte(rng()&255);auto d=Sha256Digest::from_bytes(b);auto h=d.hex();if(h.size()!=64)fail("digest hex length");auto p1=Sha256Digest::from_hex(h);if(!p1||*p1!=d)fail("digest roundtrip");
   for(char& c:h){
     if(c>='a'&&c<='f') c=char(c-'a'+'A');
   }
   auto p2=Sha256Digest::from_hex(h);
   if(p2) fail("uppercase digest accepted");
 }
 if(Sha256Digest::from_hex(std::string(63,'0')))fail("short digest accepted");
 auto bad=std::string(64,'0');bad[13]='g';if(Sha256Digest::from_hex(bad))fail("nonhex digest accepted");

 // Exercise a primary mesh lifecycle and the missing-evidence rejection path.
 using namespace fenrua::mesh; Sha256Digest::Bytes z{};auto dig=Sha256Digest::from_bytes(z);
 auto ev=[&](EventType t){return Event{t,(t==EventType::sync_completed||t==EventType::validation_accepted||t==EventType::validation_rejected||t==EventType::fault_observed)?std::optional<Sha256Digest>(dig):std::nullopt};};
 NodeStateMachine m; auto t=m.apply(ev(EventType::start_sync));if(!t.accepted||m.state()!=NodeState::syncing||t.sequence!=1)fail("mesh start");
 t=m.apply(ev(EventType::sync_completed));if(!t.accepted||m.state()!=NodeState::ready||t.sequence!=2)fail("mesh sync");
 t=m.apply(ev(EventType::begin_validation));if(!t.accepted||m.state()!=NodeState::validating)fail("mesh begin");
 t=m.apply(ev(EventType::validation_rejected));if(!t.accepted||m.state()!=NodeState::quarantined)fail("mesh reject");
 t=m.apply(ev(EventType::reset));if(!t.accepted||m.state()!=NodeState::syncing)fail("mesh reset");
 t=m.apply(ev(EventType::shutdown));if(!t.accepted||m.state()!=NodeState::stopped)fail("mesh stop");
 auto before=m.processed_events();t=m.apply(ev(EventType::start_sync));if(t.accepted||t.sequence!=before+1||m.state()!=NodeState::stopped)fail("mesh stopped reject");
 NodeStateMachine q;t=q.apply(Event{EventType::fault_observed,std::nullopt});if(t.accepted||q.state()!=NodeState::created||t.sequence!=1)fail("missing evidence");
 std::cout << "PASS: 500000 randomized field pairs, 200000 byte encodings, 100000 digest roundtrips, selected mesh paths\n";
}
