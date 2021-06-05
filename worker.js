// import { doLogic } from '.game.js'
const someObj = { a: 123 }

function doLogic(param = undefined) {
    //delay
    const finish = Date.now() + 100
    while (Date.now() < finish) {}
    return 'Done'
}

onmessage = function (event) {
    const param = event.data
    const result = doLogic(param)

    postMessage(someObj)
}
