const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const config = require('config')
const db = require('./db');
const _ = require('lodash');
const cors = require('kcors');
const md5 = require('md5');

const app = new Koa();
const router = new Router();

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (e) {
    const resError = {
      code: 500,
      message: e.message,
      errors: e.errors
    };
    if (e instanceof Error) {
      Object.assign(resError, {stack: e.stack});
    }
    Object.assign(ctx, {body: resError, status: e.status || 500});
  }
});
app.use(cors({
  allowMethods: 'GET',
}));
app.use(bodyParser());

router.get('/', (ctx) => ctx.body = {hello: 'world'})

router.get('/users', async (ctx, next) => {
  ctx.body = await db.User.find();
});
router.post('/users', async (ctx, next) => {
  const data = ctx.request.body;
  ctx.body = await db.User.insertOne(data);
});

router.get('/users/:username', async (ctx, next) => {
  const username = ctx.params.username;
  ctx.body = await db.User.findOne({username: username});
});
router.patch('/users/:username', async (ctx, next) => {
  const username = ctx.params.username;
  ctx.body = await db.User.updateOne({username: username}, ctx.request.body);
});
router.get('/top10', async (ctx, next) => {
  const games = await db.Game.find();
  const bestgames =  _.take(
    _.orderBy(
      _.values(
        _.reduce(
          games, 
          function(best, game) {
            if (_.isUndefined(best[game.userid])) {
              best[game.userid] = game
            }
            else if (best[game.userid].stats.score < game.stats.score) {
              best[game.userid] = game
            }
            return best
          }, {})),
      function(g) {
        return g.stats.score
      }, ['desc']),
    10);
  ctx.body = bestgames;
});

router.get('/games', async (ctx, next) => {
  ctx.body = await db.Game.find();
});

router.post('/games', async (ctx, next) => {
  const data = ctx.request.body;
  const passwordBuilder = data.userid + data.game
  const password = config.secret ? md5(md5(passwordBuilder) + md5(config.secret)) : 'no password';


  if (password === data.password) {
    ctx.body = await db.Game.insertOne(_.omit(data, 'password'));
  }
  else {
    ctx.throw(400, 'incorrect password')
  }
});

app.use(router.routes());

db.connect()
  .then(() => {

    app.listen(config.port, () => {
      console.info(`Listening to http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('ERROR:', err);
  });
