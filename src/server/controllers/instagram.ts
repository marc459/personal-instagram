import { Request, Response } from "express";
import { exec } from "child_process";

/**
 * Get intagram lyrics.
 *
 * @param {Request} req The express request instance
 * @param {Response} res The express response instance
 * @returns {Promise<any>}
 */
export const lyrics = async function (req: Request, res: Response): Promise<any> {
  try {
    let query = req.query.search;
    console.log(query);

    exec(`node ${process.cwd()}/dist/lib/dispatcher.js --ig-music-lyrics "${query}"`, function (error, stdout, stderr) {
      return res.status(200).json(JSON.parse(stdout));
    })
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};
