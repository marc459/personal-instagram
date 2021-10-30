import { Request, Response, NextFunction } from 'express';

export const authenticate = async function (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<any> {
	try {
		// 1) check if the token is there
		let token;

		if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
			token = req.headers.authorization.split(' ')[1];
		}
		if (!token || token !== process.env.API_SECRET) {
			throw { statusCode: 401, message: "invalid token" };
		}
		next();
	} catch (err) {
		if (err.message === 'invalid token') {
			return res.status(401).json({ message: "Invalid token!" }); // user is forbidden
		}
	}
};
