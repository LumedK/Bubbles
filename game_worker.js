export class Settings {
    static rows = 18
    static columns = 17
    static bubbleRadius = 24
    static bubbleSpeed = 10
    static bubbleHitRange = Settings.bubbleRadius * 1.25

    static fieldWidth = Settings.bubbleRadius * (2 * Settings.columns + 1)
    static fieldHeight = Settings.bubbleRadius * (2 * Settings.rows + 1) + 200

    static bubbleSpawnX = Settings.fieldWidth / 2 + 0.5 * Settings.bubbleRadius
    static bubbleSpawnY = Settings.fieldHeight - 100
    static nextBubbleSpawnX = Settings.bubbleSpawnX + 40
    static nextBubbleSpawnY = Settings.bubbleSpawnY + 40

    static aimArrowHeight = 150
    static aimArrowWidth = 30
    static minAimAngleRad = 0.1745

    static maxFps = 60

    static bubblesToPop = 3
    static maxLives = 4
    static addLineRule = [
        [1, 1, 2, 2],
        [1, 2, 3, 4],
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
        [4, 5, 6, 7]
    ] // ROW: possible balls; COLUMN: max lives; VALUE: number of adding lines
}

export function messageToWorker(command = '', attachment) {
    return { command: command, attachment: attachment }
}

function sendMessageToMainstream(workerMessage) {
    const workerData = { renderDataList: RenderObjects.getRenderData() }
    postMessage({ workerMessage, workerData })
}

export class MainstreamStuff {
    static Renders = {}
    static worker = undefined
    static currentWorkerMessage = ''
    static onWorkerMessage(workerMessage) {
        MainstreamStuff.currentWorkerMessage = workerMessage
    }
}

class Game {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            Game.onWorkerMessage(command, attachment)
        }
    })()

    static game = undefined

    constructor() {
        this.finished = false
        this.aimBubble = undefined
        this.nextBubble = undefined
        this.lives = new Lives()
        // this.clickXY = undefined
    }

    initiate() {
        Game.game = this
        RenderObjects.objects = []
        new AimArrow()
        this.aimBubble = new Bubble(Settings.bubbleSpawnX, Settings.bubbleSpawnY)
        this.nextBubble = new Bubble(Settings.nextBubbleSpawnX, Settings.nextBubbleSpawnY)
        StaticBubble.initiate()
    }

    static onWorkerMessage(command, attachment) {
        if (command === 'start_new_game') {
            new Game().loop()
        }
    }

    async loop() {
        const game = this
        game.initiate()

        AddBubblesLines.complete()
        const staticBubble = await ShootBubble.complete()
        PopFreeBubbles.complete(staticBubble)

        // clean up the suspended bubbles
    }
}

// Game events

class AbstractGameEvent {
    static complete() {
        this.sendRenderData()
    }
    static sendRenderData(workerMessage = 'event_complete') {
        sendMessageToMainstream(workerMessage)
    }
}

class AddBubblesLines extends AbstractGameEvent {
    static complete() {
        const numberOfAddingLines = this.getNumberOfAddingLines()
        this.ShiftBubbles(numberOfAddingLines)

        let numberOfNewBubbles = 0
        for (let bubble of StaticBubble.bubbles) {
            if (bubble.row > numberOfAddingLines - 1) break
            if (bubble.type) break
            numberOfNewBubbles += 1
        }

        const list = this.getRandomTypeList(numberOfNewBubbles)
        list.forEach((type, index) => {
            StaticBubble.bubbles[index].type = type
        })

        super.sendRenderData()
    }

    static getNumberOfAddingLines() {
        return Settings.addLineRule[Bubble.possibleTypes.length - 1][Game.game.lives.maxLives - 1]
    }

    static ShiftBubbles(numberOfAddingLines) {
        for (let bubble of StaticBubble.bubbles.slice().reverse()) {
            if (!bubble.type) continue
            const offsetBubbleRow = bubble.row + numberOfAddingLines
            if (offsetBubbleRow > Settings.rows - 1) continue
            let offsetBubble = StaticBubble.matrix[offsetBubbleRow][bubble.column]
            if (offsetBubble.type) continue
            offsetBubble.type = bubble.type
            bubble.type = undefined
            numberOfNewBubbles += 1
        }
    }

    static getRandomTypeList(NumberOfShiftedBubbles) {
        const list = []
        if (NumberOfShiftedBubbles === 0) return list
        const differenceTypes = new Set()
        const length = Bubble.possibleTypes.length
        for (let i = 0; i < NumberOfShiftedBubbles; i++) {
            let type = Bubble.possibleTypes[getRandomInt(0, length - 1)]
            list.push(type)
            differenceTypes.add(type)
        }
        if (Game.game.aimBubble.type) differenceTypes.add(Game.game.aimBubble.type)

        if (differenceTypes.size !== length) return getRandomTypeList()
        return list
    }
}

class ShootBubble extends AbstractGameEvent {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            ShootBubble.onWorkerMessage(command, attachment)
        }
    })()

    static onWorkerMessage(command, attachment) {
        if (command === 'click') {
            this.clickXY = attachment
            this.onClick()
        }

        if (command === 'animation_complete') {
            this.onBubbleWayAnimationComplete()
        }
    }

    static clickXY = undefined
    static onClick() {}
    static onBubbleWayAnimationComplete() {}

    static bubble
    static staticBubble
    static wayList = []

    static async complete() {
        // waiting for click
        sendMessageToMainstream('waiting_for_click')
        await new Promise((resolve, reject) => {
            this.onClick = resolve
        })

        // prepare stuff
        const aimBubble = Game.game.aimBubble
        this.bubble = new Bubble(aimBubble.x, aimBubble.y)
        this.bubble.type = aimBubble.type
        aimBubble.type = undefined

        this.bubble.animation = this.setAnimation()

        // waiting for complete animation
        await new Promise((resolve, reject) => {
            sendMessageToMainstream('waiting_for_complete_animation')
            this.onBubbleWayAnimationComplete = resolve
        })

        // complete action
        this.staticBubble.type = this.bubble.type
        this.bubble = undefined
        Game.game.aimBubble.type = Game.game.nextBubble.type
        Game.game.nextBubble.type = Bubble.getRandomType()

        sendMessageToMainstream()
        return this.staticBubble
    }

    static setAnimation() {
        this.getWayList()
        const lastVector = this.wayList[this.wayList.length - 1]
        this.addToWayList(
            new Vector(
                lastVector.endPointX,
                lastVector.endPointY,
                this.staticBubble.x,
                this.staticBubble.y
            )
        )

        return new RenderBubbleWayAnimation(this.wayList)
    }

    static addToWayList(vector) {
        const way = vector.copy()
        this.wayList.push(way)
    }

    static getStaticBubble(line, aimVector) {
        let x = 0
        const y = line[0].y
        let outLeft = false
        let outRight = false

        function checkOutSide(aimVector) {
            aimVector.setEndPointByY(y).endPointX
            x = aimVector.setEndPointByY(y).endPointX
            outLeft = x < Settings.bubbleRadius
            outRight = x > Settings.fieldWidth - Settings.bubbleRadius
        }

        checkOutSide(aimVector)
        while (outLeft || outRight) {
            // set a vector's end point (across vertical sides)
            const xSide = outLeft
                ? Settings.bubbleRadius
                : Settings.fieldWidth - Settings.bubbleRadius
            aimVector.setEndPointByX(xSide)
            // add this vector to the way list
            this.addToWayList(aimVector)
            // move and reflect the vector at the side point
            aimVector.moveTo(aimVector.endPointX, aimVector.endPointY)
            aimVector.reflectByX()
            // check 'outLeft' and 'outRight'
            checkOutSide(aimVector)
        }

        // the 'x' is inside a line
        for (let staticBubble of line) {
            const isXInsideBubble =
                staticBubble.x - Settings.bubbleRadius <= x &&
                x <= staticBubble.x + Settings.bubbleRadius
            if (isXInsideBubble) return staticBubble
        }
    }

    static getWayList() {
        const clickXY = this.clickXY

        let aimVector = new Vector(
            Settings.bubbleSpawnX,
            Settings.bubbleSpawnY,
            clickXY.x,
            clickXY.y
        )
        const clickAngle = aimVector.angle
        if (Math.abs(clickAngle) < Settings.minAimAngleRad) {
            aimVector.angle = Settings.minAimAngleRad * (clickAngle < 0 ? -1 : 1)
        }

        for (let line of StaticBubble.matrix.slice().reverse()) {
            const staticBubble = this.getStaticBubble(line, aimVector)

            const isEmptyBubble = !staticBubble.type
            // While game is running, the bottom line should have empty bubbles
            if (!isEmptyBubble) {
                aimVector.setEndPointByY(this.staticBubble.y)
                //<bug fix>: When the vector was reflected and the point on the new line was rejected, the direction of the vector became incorrect
                if (aimVector.dy > 0) {
                    aimVector = this.wayList.pop()
                    aimVector.setEndPointByX(this.staticBubble.x)
                }
                //</bug fix>
                this.addToWayList(aimVector)
                return
            }

            this.staticBubble = staticBubble

            const isLeftBubbleInHitRange =
                staticBubble.column > 0 &&
                StaticBubble.matrix[staticBubble.row][staticBubble.column - 1].x +
                    Settings.bubbleHitRange >=
                    staticBubble.x
            const isRightBubbleInHitRange =
                staticBubble.column < Settings.columns - 1 &&
                StaticBubble.matrix[staticBubble.row][staticBubble.column + 1].x -
                    Settings.bubbleHitRange <=
                    staticBubble.x

            if (isLeftBubbleInHitRange || isRightBubbleInHitRange) {
                aimVector.setEndPointByY(staticBubble.y)
                this.addToWayList(aimVector)
                return
            }
        }
    }
}

class PopFreeBubbles extends AbstractGameEvent {
    static complete(staticBubble) {
        const type = staticBubble.type
        const bubbleToClearBySteps = [[staticBubble]]
        const SameTypeBubbles = new Set([staticBubble])

        for (const step of bubbleToClearBySteps) {
            const nextStep = []
            for (const staticBubble of step) {
                for (const adjacentBubble of staticBubble.adjacentBubbles) {
                    if (adjacentBubble.type === type && !SameTypeBubbles.has(adjacentBubble)) {
                        nextStep.push(adjacentBubble)
                        SameTypeBubbles.add(adjacentBubble)
                    }
                }
            }
            if (nextStep.length > 0) bubbleToClearBySteps.push(nextStep)
        }

        if (SameTypeBubbles.length >= Settings.bubblesToPop) {
            // pop
        } else {
            // minus lives
        }
    }
}

// Renders

class AbstractRender {
    static init = (subRender) => {
        MainstreamStuff.Renders[subRender.name] = subRender
    }
    static getRenderData() {}
    static draw() {}
}

class GameRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
        //AbstractRender.GameRender = GameRender
    })()

    constructor() {
        super()
        this.field
        this.interval
        this.renderDataList = []
    }
    run() {
        const field = this.field
        field.ctx.clearRect(0, 0, field.canvas.width, field.canvas.height)
        if (!this.renderDataList) return

        const renderState = { beforeRender: undefined, onRender: undefined, afterRender: undefined }
        this.constructor.beforeRender(renderState)

        for (const renderData of this.renderDataList) {
            this.constructor.onRender(renderState)
            try {
                // const render = this.constructor[renderData.Render]
                const render = MainstreamStuff.Renders[renderData.Render]

                render.draw(this.field, renderData)
            } catch (error) {
                console.log('render error', error)
                continue
            }
        }

        this.constructor.afterRender(renderState)
    }

    static beforeRender = function (renderState) {}
    static onRender = function (renderState) {}
    static afterRender = function (renderState) {}
}

class FPSRender extends GameRender {
    static #init = (() => {
        super.init(this)
        // GameRender.FPSRender = FPSRender

        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            FPSRender.afterRender(renderState)
        }
    })()

    static startingSecond = 0
    static counter = 0
    static HTMLElement

    static afterRender = function (renderState) {
        this.HTMLElement = this.HTMLElement ? this.HTMLElement : document.getElementById('fps')
        const currentSecond = new Date().getSeconds()
        const showFPS = this.startingSecond !== currentSecond
        if (showFPS) {
            this.HTMLElement.innerHTML = this.counter
            this.startingSecond = currentSecond
            this.counter = 0
        } else {
            this.counter++
        }
    }
}

class BubbleRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
    })()

    static getRenderData(bubble) {
        if (!bubble.type)
            return {
                Render: 'BubbleRender',
                x: bubble.x,
                y: bubble.y,
                r: 1,
                type: 'bubble_0',
                animation: undefined
            }
        return {
            Render: 'BubbleRender',
            x: bubble.x,
            y: bubble.y,
            r: bubble.r,
            type: bubble.type,
            animation: bubble?.animation?.Render?.getRenderData(bubble.animation)
        }
    }

    static images = new Map([
        ['bubble_0', 'red'],
        ['bubble_1', 'green'],
        ['bubble_2', 'blue'],
        ['bubble_3', 'yellow'],
        ['bubble_4', 'orange'],
        ['bubble_5', 'purple']
    ])

    static draw(field, renderData) {
        if (renderData.animation) {
            MainstreamStuff.Renders[renderData.animation.Render].draw(field, renderData)
        }

        const ctx = field.ctx

        ctx.fillStyle = this.images.get(renderData.type)
        ctx.beginPath()
        ctx.arc(renderData.x, renderData.y, renderData.r, 0, 2 * Math.PI, false)
        ctx.fill()
    }
}

class AimArrowRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
    })()

    static getRenderData(aimArrow) {
        return {
            Render: 'AimArrowRender',
            x: Settings.bubbleSpawnX,
            y: Settings.bubbleSpawnY,
            length: Settings.aimArrowLength
        }
    }

    static draw(field, renderData) {
        const ctx = field.ctx
        const image = field.Images.aim_arrow

        const dxCursor = field.cursorX - Settings.bubbleSpawnX
        const dyCursor = field.cursorY - Settings.bubbleSpawnY
        const angle = Math.atan(dxCursor / dyCursor)

        const translateX = Settings.bubbleSpawnX
        const translateY = Settings.bubbleSpawnY

        ctx.translate(translateX, translateY)
        ctx.rotate(-angle)
        ctx.drawImage(
            image,
            Settings.aimArrowWidth / 2,
            0,
            -Settings.aimArrowWidth,
            -Settings.aimArrowHeight
        )
        ctx.rotate(+angle)
        ctx.translate(-translateX, -translateY)
    }
}

class RenderBubbleWayAnimation extends AbstractRender {
    static #init = (() => {
        super.init(this)

        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            RenderBubbleWayAnimation.afterRender(renderState)
        }

        const onWorkerMessage = MainstreamStuff.onWorkerMessage
        MainstreamStuff.onWorkerMessage = function (workerMessage) {
            onWorkerMessage(workerMessage)
            RenderBubbleWayAnimation.onWorkerMessage(workerMessage)
        }
    })()

    static isAnimationComplete = true
    static isWaitingForAnimation = false

    constructor(wayList) {
        super()
        this.Render = RenderBubbleWayAnimation
        this.wayList = wayList
    }

    static getRenderData(animation) {
        if (!animation) return undefined

        const animationData = {
            Render: 'RenderBubbleWayAnimation',
            count: 0,
            dx: 0,
            dy: 0,
            steps: []
        }
        for (let vector of animation.wayList) {
            const k = vector.length / Settings.bubbleSpeed
            const step = {
                count: Math.floor(k),
                dx: vector.dx / k,
                dy: vector.dy / k
            }
            animationData.steps.push(step)
        }

        return animationData
    }

    static draw(field, renderData) {
        const animation = renderData.animation
        //const drawingState = this.drawingState

        this.isAnimationComplete = true

        if (animation.count <= 0 && animation.steps.length === 0) {
            renderData.animation = undefined
            return // animation complete
        }

        if (animation.count <= 0) {
            const step = animation.steps.shift()
            animation.count = step.count
            animation.dx = step.dx
            animation.dy = step.dy
            if (animation.count <= 0) return // step complete
        }

        renderData.x += animation.dx
        renderData.y += animation.dy
        animation.count--

        this.isAnimationComplete = false
    }

    static onWorkerMessage(workerMessage) {
        if (workerMessage === 'waiting_for_complete_animation') {
            this.isAnimationComplete = true
            this.isWaitingForAnimation = true
        }
    }

    static afterRender(renderState) {
        if (this.isWaitingForAnimation && this.isAnimationComplete) {
            MainstreamStuff.worker.postMessage(messageToWorker('animation_complete'))
        }
    }
}

// Game objects

class RenderObjects {
    static objects = []
    constructor() {
        RenderObjects.objects.push(this)
        this.Render = AbstractRender
    }

    static getRenderData() {
        const renderDataList = []
        for (const object of RenderObjects.objects) {
            if (!object) continue
            const renderData = object.Render.getRenderData(object)
            if (!renderData) continue
            renderDataList.push(object.Render.getRenderData(object))
        }

        return renderDataList
    }
}

class Bubble extends RenderObjects {
    static possibleTypes = ['bubble_0', 'bubble_1', 'bubble_2', 'bubble_3', 'bubble_4', 'bubble_5']
    constructor(x, y) {
        super()
        this.Render = BubbleRender
        this.x = x
        this.y = y
        this.r = Settings.bubbleRadius
        this.type = this.constructor.getRandomType()
        this.animation = undefined
    }

    static getRandomType() {
        return Bubble.possibleTypes[getRandomInt(0, Bubble.possibleTypes.length - 1)]
    }
}

class StaticBubble extends Bubble {
    static bubbles = []
    static matrix = []

    constructor({ row, column, x, y }) {
        super(x, y)
        this.type = undefined
        this.row = row
        this.column = column
        this.r = Settings.bubbleRadius
        StaticBubble.bubbles.push(this)
        this.adjacentBubbles = []

        if (!StaticBubble.matrix[row]) StaticBubble.matrix[row] = []
        StaticBubble.matrix[row][column] = this
    }

    static initiate() {
        const radius = Settings.bubbleRadius
        for (let row = 0; row <= Settings.rows; row++) {
            // StaticBubble.matrix[row] = []
            for (let column = 0; column < Settings.columns; column++) {
                new StaticBubble({
                    row: row,
                    column: column,
                    x: radius * (2 * column + 1 + (row % 2)),
                    y: radius * (2 * row + 1)
                })
            }
        }

        // get adjacent bubbles
        for (let bubble of StaticBubble.bubbles) {
            function add(bubble, row, column) {
                if (!StaticBubble.matrix[row]) return
                if (!StaticBubble.matrix[row][column]) return
                bubble.adjacentBubbles.push(bubble)
            }
            add(bubble, 0, 0) // current
            add(bubble, bubble.row, bubble.column - 1) // left cell
            add(bubble, bubble.row, bubble.column + 1) // right cell
            add(bubble, bubble.row - 1, bubble.column) // top cell
            add(bubble, bubble.row - 1, bubble.column) // bottom cell
            const shift = bubble.row % 2 === 0 ? -1 : +1
            add(bubble, bubble.row - 1, bubble.column + shift) // top shift cell
            add(bubble, bubble.row - 1, bubble.column + shift) // bottom shift cell
        }
    }
}

class AimArrow extends RenderObjects {
    constructor() {
        super()
        this.Render = AimArrowRender
    }
}

// Special objects

class Lives {
    constructor() {
        this.maxLives = Settings.maxLives
        this.currentLives = Settings.maxLives
    }
}

export class Vector {
    #xStart
    #yStart
    #xEnd
    #yEnd
    #length

    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this.#xStart = x1
        this.#yStart = y1
        this.#xEnd = x2
        this.#yEnd = y2
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    get x() {
        return this.#xStart
    }
    get y() {
        return this.#yStart
    }
    get dx() {
        // the difference between the start and end point by X
        return this.#xEnd - this.#xStart
    }
    get dy() {
        // the difference between the start and end point by Y
        return this.#yEnd - this.#yStart
    }
    get endPointX() {
        return this.#xEnd
    }
    get endPointY() {
        return this.#yEnd
    }
    get length() {
        return this.#length
    }
    get angle() {
        return Math.atan(this.dy / this.dx)
    }
    set angle(newAngle) {
        this.#xEnd = Math.cos(newAngle) * this.length + this.#xStart
        this.#yEnd = Math.sin(newAngle) * this.length + this.#yStart
    }

    getX(y) {
        // get the x in a line that includes start and end points
        const k = this.dy / (y - this.#yStart)
        return this.dx / k + this.#xStart
    }
    getY(x) {
        // get the y in a line that includes start and end points
        const k = this.dx / (x - this.#xStart)
        return this.dy / k + this.#yStart
    }

    setEndPointByX(newXEnd) {
        this.#yEnd = this.getY(newXEnd)
        this.#xEnd = newXEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }
    setEndPointByY(newYEnd) {
        this.#xEnd = this.getX(newYEnd)
        this.#yEnd = newYEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }

    moveTo(x, y) {
        // replace vector by start point
        const dx = this.dx
        const dy = this.dy
        this.#xStart = x
        this.#xEnd = this.#xStart + dx
        this.#yStart = y
        this.#yEnd = this.#yStart + dy
        return this
    }

    reflectByX() {
        // reflect vector by X
        this.#xEnd = this.#xEnd - 2 * this.dx
        return this
    }

    copy() {
        return new Vector(this.#xStart, this.#yStart, this.#xEnd, this.#yEnd)
    }
}

function getRandomInt(min = 0, max = 10) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
}

onmessage = function (event) {
    const { command, attachment } = event.data
    onWorkerMessage(command, attachment)

    // let workerMessage = ''
    // if (command === 'start_new_game') {
    //     new Game()
    //     workerMessage = 'waiting_for_click'
    // } else if (command === 'click') {
    //     Game.game.clickXY = attachment
    //     workerMessage = Game.game.loop.next().value
    // } else if (command === 'animation_complete') {
    //     workerMessage = Game.game.loop.next().value
    // }

    // const workerData = { renderDataList: RenderObjects.getRenderData() }
    // this.postMessage({ workerMessage, workerData })
}

function onWorkerMessage(command, attachment) {}
