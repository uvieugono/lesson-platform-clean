'use client';

import { motion } from 'framer-motion';

const AnimationComponent = ({ animationConfig }) => (
  <motion.div
    animate={{ x: animationConfig.x, y: animationConfig.y, rotate: animationConfig.rotate }}
    transition={{ duration: animationConfig.duration }}
  >
    Animated Content
  </motion.div>
);

export default AnimationComponent;