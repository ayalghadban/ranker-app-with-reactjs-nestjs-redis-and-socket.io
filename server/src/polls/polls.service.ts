import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Poll } from 'shared/poll-types';
import { createPollID, createUserID, createNominationID } from 'src/ids';
import getResults from './getResults';
import { PollsRepository } from './polls.repository';
import {
  AddNominationFields,
  AddParticipantFields,
  CreatePollFields,
  JoinPollFields,
  RejoinPollFields,
  SubmitRankingsFields,
} from './types';

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);
  constructor(
    private readonly pollsRepository: PollsRepository,
    private readonly jwtService: JwtService,
  ) {}

  // create poll with poll repository and create access token 
  async createPoll(fields: CreatePollFields) {
    const pollID = createPollID();
    const userID = createUserID();

    const createdPoll = await this.pollsRepository.createPoll({
      ...fields,
      pollID,
      userID,
    });

    this.logger.debug(
      `Creating token string for pollID: ${createdPoll.id} and userID: ${userID}`,
    );

    const signedString = this.jwtService.sign(
      {
        pollID: createdPoll.id,
        name: fields.name,
      },
      {
        subject: userID,
      },
    );

    return {
      poll: createdPoll,
      accessToken: signedString,
    };
  }

  // join poll 
  async joinPoll(fields: JoinPollFields) {
    const userID = createUserID();

    this.logger.debug(
      `Fetching poll with ID: ${fields.pollID} for user with ID: ${userID}`,
    );

    const joinedPoll = await this.pollsRepository.getPoll(fields.pollID);

    this.logger.debug(
      `Creating token string for pollID: ${joinedPoll.id} and userID: ${userID}`,
    );

    const signedString = this.jwtService.sign(
      {
        pollID: joinedPoll.id,
        name: fields.name,
      },
      {
        subject: userID,
      },
    );

    return {
      poll: joinedPoll,
      accessToken: signedString,
    };
  }

  // rejoin poll
  async rejoinPoll(fields: RejoinPollFields) {
    this.logger.debug(
      `Rejoining poll with ID: ${fields.pollID} for user with ID: ${fields.userID} with name: ${fields.name}`,
    );

    const joinedPoll = await this.pollsRepository.addParticipant(fields);

    return joinedPoll;
  }

  // add new participant with poll repository
  async addParticipant(addParticipant: AddParticipantFields): Promise<Poll> {
    return this.pollsRepository.addParticipant(addParticipant);
  }

  // remove participant 
  async removeParticipant(
    pollID: string,
    userID: string,
  ): Promise<Poll | void> {
    const poll = await this.pollsRepository.getPoll(pollID);

    if (!poll.hasStarted) {
      const updatedPoll = await this.pollsRepository.removeParticipant(
        pollID,
        userID,
      );
      return updatedPoll;
    }
  }

  // get one poll 
  async getPoll(pollID: string): Promise<Poll> {
    return this.pollsRepository.getPoll(pollID);
  }

  // add new nomination 
  async addNomination({
    pollID,
    userID,
    text,
  }: AddNominationFields): Promise<Poll> {
    return this.pollsRepository.addNomination({
      pollID,
      nominationID: createNominationID(),
      nomination: {
        userID,
        text,
      },
    });
  }

  // remove nomination 
  async removeNomination(pollID: string, nominationID: string): Promise<Poll> {
    return this.pollsRepository.removeNomination(pollID, nominationID);
  }

  // start poll
  async startPoll(pollID: string): Promise<Poll> {
    return this.pollsRepository.startPoll(pollID);
  }

  // submin rank 
  async submitRankings(rankingsData: SubmitRankingsFields): Promise<Poll> {
    const hasPollStarted = this.pollsRepository.getPoll(rankingsData.pollID);

    if (!hasPollStarted) {
      throw new BadRequestException(
        'Participants cannot rank until the poll has started.',
      );
    }

    return this.pollsRepository.addParticipantRankings(rankingsData);
  }

  // compute results
  async computeResults(pollID: string): Promise<Poll> {
    const poll = await this.pollsRepository.getPoll(pollID);

    const results = getResults(
      poll.rankings,
      poll.nominations,
      poll.votesPerVoter,
    );

    return this.pollsRepository.addResults(pollID, results);
  }

  // exit from poll 
  async cancelPoll(pollID: string): Promise<void> {
    await this.pollsRepository.deletePoll(pollID);
  }
}
