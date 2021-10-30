import express from 'express';
import api from './api';

const app = express();

app.use('/api', api);

app.listen(3000, () =>
  console.log('Example app listening on port 3000!'),
);
