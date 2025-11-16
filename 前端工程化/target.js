async function test() {
    return await Promise.resolve('success');
}

(async () => {
   const result = await test();
   console.log(result);
})();

