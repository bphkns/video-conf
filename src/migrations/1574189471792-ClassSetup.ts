import {MigrationInterface, QueryRunner} from "typeorm";

export class ClassSetup1574189471792 implements MigrationInterface {
    name = 'ClassSetup1574189471792'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `subject` (`id` varchar(36) NOT NULL, `name` varchar(255) NOT NULL, `created_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`)) ENGINE=InnoDB", undefined);
        await queryRunner.query("CREATE TABLE `class_details` (`id` varchar(36) NOT NULL, `created_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `teacherId` varchar(36) NULL, `subjectId` varchar(36) NULL, UNIQUE INDEX `REL_30956052a2e801831aeaa89596` (`subjectId`), PRIMARY KEY (`id`)) ENGINE=InnoDB", undefined);
        await queryRunner.query("ALTER TABLE `class_details` ADD CONSTRAINT `FK_dff62ab776578b506729c30bdaa` FOREIGN KEY (`teacherId`) REFERENCES `user`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION", undefined);
        await queryRunner.query("ALTER TABLE `class_details` ADD CONSTRAINT `FK_30956052a2e801831aeaa895964` FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` DROP FOREIGN KEY `FK_30956052a2e801831aeaa895964`", undefined);
        await queryRunner.query("ALTER TABLE `class_details` DROP FOREIGN KEY `FK_dff62ab776578b506729c30bdaa`", undefined);
        await queryRunner.query("DROP INDEX `REL_30956052a2e801831aeaa89596` ON `class_details`", undefined);
        await queryRunner.query("DROP TABLE `class_details`", undefined);
        await queryRunner.query("DROP TABLE `subject`", undefined);
    }

}
