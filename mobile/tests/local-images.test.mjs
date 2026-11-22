import test from 'node:test';
import assert from 'node:assert/strict';
import {isLocalStorageImage} from '../src/local-images.ts';
test('local image bridge only accepts emulator storage image paths',()=>{
 assert.equal(isLocalStorageImage('http://10.0.2.2:54321/storage/v1/object/sign/actvity-notes/photo.jpg?token=test'),true);
 for(const url of ['https://example.com/storage/v1/object/sign/a','http://10.0.2.2:54321/auth/v1/user','http://10.0.2.2.evil:54321/storage/v1/object/sign/a','blob:https://localhost/id'])assert.equal(isLocalStorageImage(url),false);
});
