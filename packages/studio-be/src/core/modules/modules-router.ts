import { FlowGeneratorMetadata, Logger } from 'botpress/sdk'
import { UnexpectedError } from 'common/http'
import { SkillService } from 'core/dialog'
import { ModuleLoader } from 'core/modules'
import { CustomRouter } from 'core/routers/customRouter'
import { AuthService, TOKEN_AUDIENCE, checkTokenHeader } from 'core/security'
import { RequestHandler, Router } from 'express'
import _ from 'lodash'
import yn from 'yn'

export class ModulesRouter extends CustomRouter {
  private checkTokenHeader!: RequestHandler

  constructor(
    private logger: Logger,
    private authService: AuthService,
    private moduleLoader: ModuleLoader,
    private skillService: SkillService
  ) {
    super('Modules', logger, Router({ mergeParams: true }))
    this.checkTokenHeader = checkTokenHeader(this.authService, TOKEN_AUDIENCE)
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.router.get('/', (_req, res) => {
      res.json(this.moduleLoader.getLoadedModules())
    })

    this.router.get(
      '/skills',
      this.checkTokenHeader,
      this.asyncMiddleware(async (_req, res, _next) => {
        res.send(await this.moduleLoader.getAllSkills())
      })
    )

    this.router.post(
      '/:moduleName/skill/:skillId/generateFlow',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req, res) => {
        const flowGenerator = this.moduleLoader.getFlowGenerator(req.params.moduleName, req.params.skillId)
        if (!flowGenerator) {
          return res.status(404).send('Invalid module name or flow name')
        }

        try {
          const metadata: FlowGeneratorMetadata = {
            botId: req.query.botId?.toString() || '',
            isOneFlow: yn(req.query.isOneFlow)
          }
          res.send(this.skillService.finalizeFlow(await flowGenerator(req.body, metadata)))
        } catch (err) {
          throw new UnexpectedError('Could not generate flow', err)
        }
      })
    )

    this.router.get(
      '/translations',
      this.checkTokenHeader,
      this.asyncMiddleware(async (_req, res, _next) => {
        res.send(await this.moduleLoader.getTranslations())
      })
    )

    this.router.get(
      '/dialogConditions',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req, res) => {
        const conditions = await this.moduleLoader.getDialogConditions()
        res.send(conditions)
      })
    )
  }
}
