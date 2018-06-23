/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:ImageSpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(16,16), new Vec2(8,8));
});


//  Enemy
//
class Enemy extends Entity {

    constructor(pos: Vec2) {
	super(pos);
    }
}

class Bird extends Enemy {

    movement: Vec2;

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(1);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
        this.movement = new Vec2(rnd(2)*2-1, 0);
    }

    onTick() {
	super.onTick();
        this.movePos(this.movement);
        let area = this.world.area;
        if ((this.pos.x < 0 && this.movement.x < 0) ||
            (area.width < this.pos.x && 0 < this.movement.x)) {
            this.movement.x = -this.movement.x;
        }
        this.scale = new Vec2(sign(this.movement.x), 1);
    }

    onCollided(entity: Entity) {
        if (entity instanceof Player) {
            this.stop();
        }
    }
}

//  Player
//
class Player extends Entity {

    game: Game;
    vx: number = 0;
    vy: number = 0;
    gx: number = -1;
    jumping: boolean = false;

    constructor(game: Game, pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(0);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
        this.game = game;
    }

    onTick() {
	super.onTick();
        let vx = this.vx;
        if (0 <= this.gx) {
            vx = this.gx - this.pos.x;
            if (Math.abs(vx) < 8) { vx = 0; }
        }
        if (vx != 0) {
            this.scale = new Vec2(sign(vx), 1);
            this.pos.x = clamp(0, this.pos.x+sign(vx)*4, this.world.area.width);
        }
        this.vy += 1;
        if (this.jumping) {
            this.vy = upperbound(this.vy, 16);
        } else {
            this.vy = upperbound(this.vy, 8);
        }
        let yy = this.game.ty;
        if (yy < this.pos.y+this.vy) {
            this.pos.y = yy-(this.pos.y+this.vy-yy);
            this.vy = this.game.jump(this.vy);
            this.jumping = true;
        } else {
	    this.pos.y += this.vy;
        }
    }

    setMove(vx: number) {
	this.vx = vx;
        this.gx = -1;
    }
    setGoal(p: Vec2) {
        this.gx = p.x;
    }

    onCollided(entity: Entity) {
        if (entity instanceof Enemy) {
            this.jumping = false;
            this.vy = 0;
            this.game.bump();
        }
    }
}


//  Game
//
class Game extends GameScene {

    textbox: TextBox;
    clouds: StarSprite;
    player: Player;
    vy: number;
    ty: number;
    impact: Vec2 = new Vec2();

    onStart() {
	super.onStart();
	this.textbox = new TextBox(this.screen.inflate(-8,-8), FONT);

        let area = this.world.area;
        area.height = 1000;
	this.clouds = new StarSprite(
            area.inflate(40, -80), 50, 5,
            [new RectSprite('rgba(255,255,255,0.9)', new Rect(-10,-10,20,20)),
             new RectSprite('rgba(255,255,255,0.8)', new Rect(-20,-10,40,20))]);
	this.player = new Player(this, new Vec2(area.width/2, area.height-100));
	this.add(this.player);

        for (let i = 0; i < 10; i++) {
            let p = new Vec2(rnd(area.width), rnd(area.height-100));
            this.add(new Bird(p));
        }
        this.ty = area.height-8;
        this.vy = -12;
    }

    onTick() {
	super.onTick();
	this.clouds.move(new Vec2(+1, 0));
        let target = this.player.pos.expand(0, this.screen.height);
        this.world.setCenter(target, this.world.area);
        this.impact.y = lowerbound(0, this.impact.y-1);
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v.x);
    }
    onMouseMove(p: Vec2) {
	this.player.setGoal(p);
    }

    jump(vy: number): number {
        APP.playSound('jump1')
        this.vy -= 2;
        this.impact = new Vec2(this.player.pos.x, 8);
        return this.vy;
    }

    bump() {
        APP.playSound('explosion');
        this.vy = -12;
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.save();
	ctx.translate(-this.world.window.x, -this.world.window.y);
        let area = this.world.area;
        let yy = int(area.height/3);
	ctx.fillStyle = '#001080';
	ctx.fillRect(0, 0, area.width, yy);
	ctx.fillStyle = '#0020c0';
	ctx.fillRect(0, yy, area.width, area.height-yy);
	this.clouds.render(ctx);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.ty);
        ctx.lineTo(this.impact.x, this.ty+this.impact.y);
        ctx.lineTo(area.width, this.ty);
        ctx.stroke();
	ctx.restore();
	super.render(ctx);
	this.textbox.render(ctx);
    }
}
