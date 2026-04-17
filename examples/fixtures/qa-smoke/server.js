const path = require('path');

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const { body, validationResult } = require('express-validator');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'qa-smoke-dev-session',
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('index', {
    title: 'QA Server',
    message: req.flash('info')[0] || 'QA smoke fixture is ready.',
  });
});

app.post(
  '/echo',
  [body('message').isString().trim().notEmpty()],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const message = req.body.message.trim();
    req.flash('info', message);
    return res.json({ status: 'ok', message });
  }
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
