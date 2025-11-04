const btn = document.querySelector('button')

function Counter() {
  this.count = 0
  btn.addEventListener('click', function () {
    this.count++
    console.log(this.count) 
  })
}

new Counter()
