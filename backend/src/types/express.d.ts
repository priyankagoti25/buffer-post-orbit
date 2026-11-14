declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. The id of the logged-in user of YOUR website. */
      userId?: string;
    }
  }
}

export {};
