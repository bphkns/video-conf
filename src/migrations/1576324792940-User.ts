import {MigrationInterface, QueryRunner} from "typeorm";

export class User1576324792940 implements MigrationInterface {
    name = 'User1576324792940'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `user` ADD `name` varchar(255) NOT NULL", undefined);
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL DEFAULT null", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL", undefined);
        await queryRunner.query("ALTER TABLE `user` DROP COLUMN `name`", undefined);
    }

}
