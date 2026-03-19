import { Router } from 'express';
const router = Router();

router.post('/login', (req, res) => {
  console.log(req.body); // Example usage
  res.send('Login route');
});
export default router;