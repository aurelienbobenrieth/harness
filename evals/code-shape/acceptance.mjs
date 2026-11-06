const header = `import test from 'node:test';
import assert from 'node:assert/strict';
import {Effect} from 'effect';
import {api} from './src/api.ts';
import {memoryStore} from './src/memory-store.ts';
import {CarrierFailure} from './src/errors.ts';
const order={id:'o1',customerId:'c1',status:'open',lines:[{sku:'a',unitCents:1000,quantity:2}]};
const carrier={createLabel:()=>Effect.succeed({tracking:'t1'})};
`;
/** Independent literal oracles, installed only after the agent has finished. */
export const acceptance = {
  boundary:
    header +
    `test('summary preserves the boundary and exact wire shape',async()=>{
    const service=api(memoryStore([order]),carrier);
    assert.deepEqual(await Effect.runPromise(service.summary('o1')),{id:'o1',customerId:'c1',itemCount:2,subtotalCents:2000,status:'open'});
    assert.equal((await Effect.runPromise(Effect.flip(service.summary('missing'))))._tag,'OrderNotFound');
    assert.equal(await Effect.runPromise(service.quote('o1')),2800);
  });`,
  duplication:
    header +
    `test('quote and receipt retain independent pricing oracles',async()=>{
    for(const [cents,expected] of [[4999,6399],[5000,6000],[3,404]]){
      const service=api(memoryStore([{...order,lines:[{sku:'a',unitCents:cents,quantity:1}]}]),carrier);
      assert.equal(await Effect.runPromise(service.quote('o1')),expected);
      assert.equal(await Effect.runPromise(service.receipt('o1')),'o1: '+expected+' cents');
    }
  });`,
  regression:
    header +
    `test('discount means remaining price and rounds once',async()=>{
    const service=api(memoryStore([order]),carrier);
    assert.equal(await Effect.runPromise(service.discounted('o1',20)),1600);
    assert.equal(await Effect.runPromise(service.discounted('o1',0)),2000);
    assert.equal(await Effect.runPromise(service.discounted('o1',100)),0);
    const fractional=api(memoryStore([{...order,lines:[{sku:'a',unitCents:101,quantity:1}]}]),carrier);
    assert.equal(await Effect.runPromise(fractional.discounted('o1',50)),51);
    assert.equal((await Effect.runPromise(Effect.flip(service.discounted('missing',20))))._tag,'OrderNotFound');
  });`,
  retry:
    header +
    `test('retry is bounded, selective and preserves identity and state',async()=>{
    for(const [failures,retryable,expectedCalls,success] of [[2,true,3,true],[9,true,3,false],[9,false,1,false]]){
      let calls=0; const keys=[]; const store=memoryStore([order]);
      const service=api(store,{createLabel:input=>Effect.suspend(()=>{
        calls++;keys.push(input.idempotencyKey);
        return calls<=failures?Effect.fail(new CarrierFailure(retryable)):Effect.succeed({tracking:'t1'});
      })});
      const result=await Effect.runPromise(Effect.either ? Effect.either(service.ship('o1')) : Effect.result(service.ship('o1')));
      assert.equal(calls,expectedCalls);assert.deepEqual(keys,Array(expectedCalls).fill('ship:o1'));
      assert.equal((await Effect.runPromise(store.get('o1'))).status,success?'shipped':'open');
      if(success) assert.match(JSON.stringify(result),/t1/);
    }
  });`,
};
