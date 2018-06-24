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

    hits: number = 0;
    lastHit: number = 0;

    constructor(pos: Vec2) {
	super(pos);
    }

    onCollided(entity: Entity) {
        if (entity instanceof Player) {
            let t = getTime();
            if (this.lastHit+1 < t) {
                this.lastHit = t;
                this.hits++;
                if (3 <= this.hits) {
                    this.stop();
                }
            }
        }
    }
}

class Spike extends Enemy {

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(2);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
    }
}

class Asteroid extends Enemy {

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(5);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
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
        if ((this.pos.x < area.x && this.movement.x < 0) ||
            (area.x1() < this.pos.x && 0 < this.movement.x)) {
            this.movement.x = -this.movement.x;
        }
        this.scale = new Vec2(sign(this.movement.x), 1);
    }
}

//  Player
//
class Player extends Entity {

    game: Game;
    vx: number = 0;
    vy: number = 0;
    gx: number|null = null;
    dying: boolean = false;

    constructor(game: Game, pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(0);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
        this.game = game;
        this.scale = new Vec2(1, 1);
    }

    onTick() {
	super.onTick();
        let area = this.game.current.area;
        let vx = this.vx;
        if (this.gx !== null) {
            vx = this.gx - this.pos.x;
            if (Math.abs(vx) < 8) { vx = 0; }
        }
        if (vx != 0) {
            this.scale.x = sign(vx);
            this.pos.x = clamp(area.x, this.pos.x+sign(vx)*4, area.x1());
        }
        this.scale.y = (this.dying)? -1 : 1;
        this.vy += 1;
        if (this.dying) {
            this.vy = upperbound(this.vy, 8);
        } else {
            this.vy = upperbound(this.vy, 16);
        }
        let yy = this.game.getty();
        if (0 < yy && yy < this.pos.y+this.vy) {
            this.pos.y = yy-(this.pos.y+this.vy-yy);
            this.vy = this.game.jump(this.vy);
            this.dying = false;
        } else {
	    this.pos.y += this.vy;
        }
    }

    setMove(vx: number) {
	this.vx = vx;
        this.gx = null;
    }
    setGoal(p: Vec2) {
        this.gx = p.x;
    }

    onCollided(entity: Entity) {
        if (entity instanceof Enemy) {
            if (!this.dying) {
                this.dying = true;
                this.vy = 0;
                this.game.bump();
            }
        }
    }
}


//  Game
//
class Game extends Scene {

    textbox: TextBox;
    startTime: number;
    current: World;
    player: Player;
    vy: number;

    world1: World;
    clouds: StarSprite;
    impact: Vec2;

    world2: World;
    stars: StarSprite;

    onStart() {
	super.onStart();
	this.textbox = new TextBox(this.screen.inflate(-16,-16), FONT);
        this.startTime = getTime();

        // World1
        {
            let area = new Rect(-this.screen.width/2, 0, this.screen.width, 1000);
            this.world1 = new World(area);
            this.world1.window = this.screen.copy();
	    this.clouds = new StarSprite(
                area.inflate(80, -80), 50, 5,
                [new OvalSprite('rgba(255,255,255,0.9)', new Rect(-20,-5,40,10)),
                 new OvalSprite('rgba(255,255,255,0.8)', new Rect(-40,-20,80,40))]);
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world1.add(new Bird(p));
            }
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world1.add(new Spike(p));
            }
            this.impact = new Vec2();
        }

        // World2
        {
            let area = new Rect(-this.screen.width, 0, this.screen.width*2, 2000);
            this.world2 = new World(area);
            this.world2.window = this.screen.scale(2);
	    this.stars = new StarSprite(
                area.inflate(0, -20), 100, 2,
                [new RectSprite('#cccccc', new Rect(-2,-2,4,4))]);
            for (let i = 0; i < 10; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world2.add(new Asteroid(p));
            }
        }

	this.player = new Player(this, new Vec2(0, 100));
        this.vy = -12;
	this.world1.add(this.player);
	this.world2.add(this.player);

        this.current = this.world2;
    }

    onTick() {
	super.onTick();
	this.current.onTick();
        if (this.current === this.world1) {
	    this.clouds.move(new Vec2(+1, 0));
            let target = this.player.pos.expand(
                this.current.window.width, this.current.window.height);
            this.world1.setCenter(target, this.world1.area);
            this.impact.y = lowerbound(0, this.impact.y-1);
            if (this.player.pos.y < 0) {
                this.player.pos.y += this.world2.area.height;
                this.current = this.world2;
            }
        } else if (this.current === this.world2) {
	    this.stars.move(new Vec2(1, -1));
            let target = this.player.pos.expand(
                this.current.window.width, this.current.window.height);
            this.world2.setCenter(target, this.world2.area);
            if (this.player.pos.y < 0) {
                //this.current = this.world3;
                //this.player.pos.y += this.world3.area.height;
            } else if (this.world2.area.height < this.player.pos.y) {
                this.player.pos.y -= this.world2.area.height;
                this.current = this.world1;
            }
        }
        let t = int(getTime()-this.startTime);
        let s = int(t/60)+':'+format(t % 60, 2, '0')
        this.textbox.clear();
        this.textbox.putText([s], 'center', 'bottom');
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v.x);
    }
    onMouseMove(p: Vec2) {
        let window = this.current.window;
        p.x = window.x + (window.width*p.x/this.screen.width);
        p.y = window.y + (window.height*p.y/this.screen.height);
	this.player.setGoal(p);
    }

    getty(): number {
        if (this.current === this.world1) {
            return this.world1.area.height-8;
        }
        return 0;
    }

    jump(vy: number): number {
        APP.playSound('jump1')
        this.vy -= 4;
        this.impact = new Vec2(this.player.pos.x, 8);
        return this.vy;
    }

    bump() {
        APP.playSound('explosion');
        this.vy = -12;
    }

    render(ctx: CanvasRenderingContext2D) {
	super.render(ctx);
        if (this.current === this.world1) {
            let area = this.world1.area;
	    ctx.save();
	    ctx.translate(-this.world1.window.x, -this.world1.window.y);
            {
	        ctx.save();
	        ctx.translate(area.x, area.y);
                let y: number;
                let c: Color;
                for (let i = 0; i < 10; i++) {
                    y = i*area.height/20;
                    c = new Color(0,0.08+i*0.006,0.4+i*0.1);
	            ctx.fillStyle = c.toString();
	            ctx.fillRect(0, y, area.width, y+area.height/20);
                }
	        ctx.fillRect(0, y, area.width, area.height-y);
	        this.clouds.render(ctx);
	        ctx.restore();
            }
            let ty = this.getty();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(area.x, ty);
            ctx.lineTo(this.impact.x, ty+this.impact.y);
            ctx.lineTo(area.x1(), ty);
            ctx.stroke();
	    ctx.restore();
            this.current.render(ctx);
        } else if (this.current === this.world2) {
            let area = this.world2.area;
	    ctx.save();
            ctx.scale(0.5, 0.5);
            {
	        ctx.save();
	        ctx.translate(-this.world2.window.x, -this.world2.window.y);
	        ctx.translate(area.x, area.y);
                let y: number = area.height/2;
                let c: Color;
	        ctx.fillRect(0, 0, area.width, y);
                for (let i = 0; i < 10; i++) {
                    y = area.height/2+i*area.height/20;
                    c = new Color(0,i*0.04,i*0.1);
	            ctx.fillStyle = c.toString();
	            ctx.fillRect(0, y, area.width, y+area.height/20);
                }
	        this.stars.render(ctx);
	        ctx.restore();
            }
            this.current.render(ctx);
	    ctx.restore();
        }
	this.textbox.render(ctx);
    }
}
