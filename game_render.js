import { Settings, Message, GameObject } from './game_worker.js'

class Images {
    static getImage(src) {
        const image = new Image()
        image.src = src
        return image
    }

    static ball_1 = Images.getImage('img/cat.png')
    static ball_2 = Images.getImage('img/ghost.png')
    static ball_3 = Images.getImage('img/demon.png')
    static ball_4 = Images.getImage('img/pumpkin.png')
    static ball_5 = Images.getImage('img/vampire.png')
    static ball_6 = Images.getImage('img/zombie.png')
}

class Field {
    constructor() {
        this.cursorX = -1
        this.cursorY = -1
        this.clickX = -1
        this.clickY = -1

        this.canvas = document.getElementById('gameField')
        this.ctx = this.canvas.getContext('2d')
        this.canvas.width = Settings.fieldWidth
        this.canvas.height = Settings.fieldHeight
        this.canvas.addEventListener('mousemove', this.mouseEvent.bind(this))
        this.canvas.addEventListener('click', this.clickEvent.bind(this))
    }

    translateCursor(layerX, layerY) {
        return {
            x: (this.canvas.width / this.canvas.offsetWidth) * layerX,
            y: (this.canvas.height / this.canvas.offsetHeight) * layerY
        }
    }

    mouseEvent(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.cursorX = cursorXY.x
        this.cursorY = cursorXY.y
    }

    clickEvent(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.clickX = cursorXY.x
        this.clickY = cursorXY.y
        new Message('on_click', cursorXY).post()
    }
}

class Render {
    constructor(field, list = []) {
        this.field = field
        this.list = list
        this.interval = setInterval(this.run.bind(this), 1000 / Settings.maxFps)

        this.fps = {
            counter: 0,
            startingSecond: new Date().getSeconds(),
            element: document.getElementById('fps'),
            show() {
                const currentSecond = new Date().getSeconds()
                this.counter++
                if (this.startingSecond !== currentSecond) {
                    this.element.innerHTML = this.counter
                    this.startingSecond = currentSecond
                    this.counter = 0
                }
            }
        }
    }

    run() {
        function haveAnimation(renderObject) {
            return Boolean(renderObject.trajectory) // or animation
        }
        const field = this.field
        let animationComplete = undefined

        field.ctx.clearRect(0, 0, field.canvas.width, field.canvas.height)

        for (let renderObject of this.list) {
            try {
                const objectType = renderObject.type
                const gameObject = GameObject[objectType]
                const image = Images[renderObject.imageName]
                const objectHaveAnimation = haveAnimation(renderObject)

                gameObject.render(renderObject, field, image)

                if (objectHaveAnimation) {
                    animationComplete =
                        animationComplete === undefined
                            ? !haveAnimation(renderObject)
                            : animationComplete && !haveAnimation(renderObject)
                }
            } catch (error) {
                console.log('render error', error)
                continue
            }
        }

        if (animationComplete) {
            new Message('animation_complete').post()
        }

        this.fps.show()
    }
}

function onmessage(event) {
    const message = event.data
    if (message.action === 'to_render') {
        render.list = message.attachment
    }
}

// INITIALIZATION
const field = new Field()
const render = new Render(field)

Message.worker = new Worker('game_worker.js', { type: 'module' })
Message.onmessage = onmessage

// RUN
new Message('start_game').post()

//*
//*
//*
//*
//*
//*
//*
//*

// class Field_Old {
//     static canvas = document.getElementById('gameField')
//     static ctx = Field.canvas.getContext('2d')
//     static cursorX = 0
//     static cursorY = 0
//     static clickX = -1
//     static clickY = -1

//     // static backgroundTask = new Worker('game_worker.js', { type: 'module' })
//     static renderingList = []

//     static renderInterval = undefined

//     static images = Field.#getImages()
//     static #getImages() {
//         const images = new Map()
//         function getImage(path) {
//             const image = new Image()
//             image.src = path
//             return image
//         }

//         images.set('ball_1', getImage('img/cat.png'))
//         // images.set('ball_1_pop_0', getImage('img/cat_pop0.png'))
//         // images.set('ball_1_pop_1', getImage('img/cat_pop1.png'))
//         // images.set('ball_1_pop_2', getImage('img/cat_pop2.png'))

//         images.set('ball_2', getImage('img/ghost.png'))
//         // images.set('ball_2_pop_0', getImage('img/ghost_pop0.png'))
//         // images.set('ball_2_pop_1', getImage('img/ghost_pop1.png'))
//         // images.set('ball_2_pop_2', getImage('img/ghost_pop2.png'))

//         images.set('ball_3', getImage('img/pig.png'))
//         // images.set('ball_3_pop_0', getImage('img/pig_pop0.png'))
//         // images.set('ball_3_pop_1', getImage('img/pig_pop1.png'))
//         // images.set('ball_3_pop_2', getImage('img/pig_pop2.png'))

//         images.set('ball_4', getImage('img/pumpkin.png'))
//         // images.set('ball_4_pop_0', getImage('img/pumpkin_pop0.png'))
//         // images.set('ball_4_pop_1', getImage('img/pumpkin_pop1.png'))
//         // images.set('ball_4_pop_2', getImage('img/pumpkin_pop2.png'))

//         images.set('ball_5', getImage('img/vampire.png'))
//         // images.set('ball_5_pop_0', getImage('img/vampire_pop0.png'))
//         // images.set('ball_5_pop_1', getImage('img/vampire_pop1.png'))
//         // images.set('ball_5_pop_2', getImage('img/vampire_pop2.png'))

//         images.set('ball_6', getImage('img/zombie.png'))
//         // images.set('ball_6_pop_0', getImage('img/zombie_pop0.png'))
//         // images.set('ball_6_pop_1', getImage('img/zombie_pop1.png'))
//         // images.set('ball_6_pop_2', getImage('img/zombie_pop2.png'))

//         return images
//     }

//     static init() {
//         function getCursor(layerX, layerY) {
//             return {
//                 x: (Field.canvas.width / Field.canvas.offsetWidth) * layerX,
//                 y: (Field.canvas.height / Field.canvas.offsetHeight) * layerY
//             }
//         }

//         Field.canvas.width = Settings.fieldWidth
//         Field.canvas.height = Settings.fieldHeight

//         Field.canvas.addEventListener('mousemove', (event) => {
//             const cursorXY = getCursor(event.layerX, event.layerY)
//             Field.cursorX = cursorXY.x
//             Field.cursorY = cursorXY.y
//         })

//         Field.canvas.addEventListener('click', (event) => {
//             const cursorXY = getCursor(event.layerX, event.layerY)
//             Field.clickX = cursorXY.x
//             Field.clickY = cursorXY.y
//             Field.sendTaskMessage(Message.clickOnField, {
//                 clickX: Field.clickX,
//                 clickY: Field.clickY
//             })
//         })

//         Field.backgroundTask.onmessage = Field.readTaskMessage
//         Field.renderInterval = setInterval(Field.render, 1000 / Settings.maxFps)
//     }

//     static fps = {
//         fps: 0,
//         sec: new Date().getSeconds(),
//         show() {
//             const curSec = new Date().getSeconds()
//             this.fps++
//             if (this.sec !== curSec) {
//                 document.getElementById('fps').innerHTML = this.fps
//                 this.sec = curSec
//                 this.fps = 0
//             }
//         }
//     }

//     static render() {
//         Field.ctx.clearRect(0, 0, Field.canvas.width, Field.canvas.height)

//         Field.renderingList.forEach((renderingObject) => {
//             const isRender =
//                 Boolean(renderingObject) &&
//                 Boolean(renderingObject.type) &&
//                 Boolean(GameObject[renderingObject.type]) &&
//                 Boolean(GameObject[renderingObject.type].render)

//             if (isRender) {
//                 GameObject[renderingObject.type].render(renderingObject, Field)
//             }
//         })
//         Field.fps.show()
//     }

//     static sendTaskMessage(message, parameter) {
//         Field.backgroundTask.postMessage({
//             message: message,
//             parameter: parameter
//         })
//     }

//     static readTaskMessage(event) {
//         if (!Array.isArray(event.data)) {
//             return
//         }
//         Field.renderingList = event.data
//     }
// }

// Field.init()
// Field.sendTaskMessage(Message.startGame)
