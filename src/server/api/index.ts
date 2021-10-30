import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/authentication';
import { lyrics } from '../controllers/instagram';

const router = Router();

const apiLimiter = rateLimit({
  windowMs: 4000, // 15 minutes
  max: 1
});

router.use(authenticate);
router.use(apiLimiter);
router.get('/instagram/lyrics', lyrics);

export default router;
