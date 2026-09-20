import { generatorRepository } from "../repositories/generatorRepository.js";
import { generatorLogRepository } from "../repositories/generatorLogRepository.js";
import { NotFoundError } from "../errors/AppError.js";

async function findActiveGenerator(id) {
  const generator = await generatorRepository.findById(id);
  if (!generator || !generator.isActive) throw new NotFoundError("Generator not found");
  return generator;
}

export const generatorService = {
  /**
   * Records a usage/fuel log and adds its hoursRun to the generator's
   * runningHoursTotal. The increment itself is atomic ($inc); the two
   * writes are not a transaction, so if the increment fails the log is
   * removed again to keep the total and the log history consistent.
   */
  async recordLog({ generatorId, recordedBy, ...fields }) {
    await findActiveGenerator(generatorId);

    const log = await generatorLogRepository.create({ ...fields, generator: generatorId, recordedBy });

    let generator;
    try {
      generator = await generatorRepository.incrementRunningHours(generatorId, log.hoursRun);
    } catch (err) {
      await generatorLogRepository.deleteById(log._id);
      throw err;
    }

    return { log, generator };
  },

  /**
   * Deletes a log and subtracts its hoursRun from the generator's total —
   * the reverse of recordLog, so removing a mistaken entry doesn't leave
   * runningHoursTotal overstated.
   */
  async removeLog(logId) {
    const log = await generatorLogRepository.deleteById(logId);
    if (!log) throw new NotFoundError("Log entry not found");

    const generator = await generatorRepository.incrementRunningHours(log.generator, -log.hoursRun);
    return { log, generator };
  },
};
